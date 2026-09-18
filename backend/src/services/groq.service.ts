import { ragDevLog } from './rag/devLog.js';

export type GroqGenerateTextInput = {
  model?: string;
  prompt: { system?: string; user: string };
  config?: { temperature?: number; maxOutputTokens?: number };
};

export type GroqGenerateTextOutput = {
  content: string;
  tokensUsed?: number;
  model: string;
  finishReason?: string;
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  rawResponseLength: number;
};

const DEFAULT_MODEL = 'openai/gpt-oss-20b';

async function fetchLiveProductionModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<{ id: string; active?: boolean }> };
    if (!data.data || !Array.isArray(data.data)) return [];
    // Extract live model IDs from Groq API
    const liveIds = data.data.map((m) => m.id);
    // Sort live models putting preferred production models first
    return liveIds.sort((a, b) => {
      const prefOrder = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
      const indexA = prefOrder.indexOf(a);
      const indexB = prefOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });
  } catch (err) {
    ragDevLog('groq:fetch-models-error', { error: String(err) });
    return [];
  }
}

export const groqService = {
  async generateText(input: GroqGenerateTextInput): Promise<GroqGenerateTextOutput> {
    const apiKey = process.env.GROQ_API_KEY;
    const configuredModel = input.model || process.env.GROQ_MODEL || DEFAULT_MODEL;
    const temperature = input.config?.temperature ?? 0.3;
    const maxTokens = input.config?.maxOutputTokens ?? 1800;

    if (!apiKey) {
      ragDevLog('groq:error', { reason: 'GROQ_API_KEY is not set in environment.' });
      throw new Error('GROQ_API_KEY is missing in environment variables. Groq is required for final answer generation.');
    }

    const hasSystemInstruction = !!input.prompt.system;
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (input.prompt.system) {
      messages.push({ role: 'system', content: input.prompt.system });
    }
    messages.push({ role: 'user', content: input.prompt.user });

    // Initial model candidate queue starting strictly with configured model
    let modelsToTry = [configuredModel];
    let liveFetched = false;
    let lastError: Error | null = null;
    const failedModels = new Set<string>();

    for (let i = 0; i < modelsToTry.length; i++) {
      const modelCandidate = modelsToTry[i]!;
      if (failedModels.has(modelCandidate)) continue;

      ragDevLog('groq:model-selected', { model: modelCandidate });
      ragDevLog('groq:request', {
        model: modelCandidate,
        userPromptChars: input.prompt.user.length,
        hasSystemInstruction,
        temperature,
        maxTokens,
      });

      const startTime = Date.now();
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelCandidate,
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          ragDevLog('groq:api-error', { model: modelCandidate, status: response.status, body: errText });
          lastError = new Error(`Groq API model "${modelCandidate}" returned HTTP ${response.status}: ${errText}`);
          failedModels.add(modelCandidate);

          // If model decommissioned or not found, dynamically fetch live models from Groq API once
          if (
            (response.status === 404 || response.status === 400 || errText.includes('model_not_found') || errText.includes('decommissioned')) &&
            !liveFetched
          ) {
            liveFetched = true;
            ragDevLog('groq:fetching-live-models', { reason: `Model ${modelCandidate} failed with HTTP ${response.status}` });
            const liveModels = await fetchLiveProductionModels(apiKey);
            ragDevLog('groq:live-models-discovered', { count: liveModels.length, models: liveModels });
            for (const liveM of liveModels) {
              if (!modelsToTry.includes(liveM) && !failedModels.has(liveM)) {
                modelsToTry.push(liveM);
              }
            }
          }
          continue;
        }

        const data = (await response.json()) as {
          model?: string;
          choices?: Array<{
            message?: { content?: string };
            finish_reason?: string;
          }>;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          };
        };

        const content = data.choices?.[0]?.message?.content?.trim() ?? '';
        if (!content) {
          throw new Error(`Groq model "${modelCandidate}" returned empty completion content.`);
        }

        const latencyMs = Date.now() - startTime;
        const tokensUsed = data.usage?.total_tokens;
        const finalModel = data.model || modelCandidate;

        ragDevLog('groq:generation-success', {
          model: finalModel,
          httpStatus: 200,
          latencyMs,
          outputLength: content.length,
          tokensUsed,
          hasSystemInstruction,
          finishReason: data.choices?.[0]?.finish_reason || 'stop',
        });

        return {
          content,
          tokensUsed,
          model: finalModel,
          finishReason: data.choices?.[0]?.finish_reason || 'stop',
          promptTokenCount: data.usage?.prompt_tokens,
          candidatesTokenCount: data.usage?.completion_tokens,
          rawResponseLength: content.length,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        failedModels.add(modelCandidate);
        ragDevLog('groq:request-failed', { model: modelCandidate, error: String(error) });
      }
    }

    ragDevLog('groq:all-models-failed', { lastError: lastError?.message });
    throw new Error(`Groq answer generation failed: ${lastError?.message || 'All Groq models failed.'}`);
  },
};


