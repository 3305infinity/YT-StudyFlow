import { GEMINI_DEFAULTS, logDev } from './gemini.config.js';
import { emptyResponseError } from './gemini.errors.js';
import { assertOkResponse, geminiPost } from './gemini.http.js';
import {
  extractBatchEmbeddings,
  extractSingleEmbedding,
  extractText,
  parseJsonBody,
} from './gemini.parse.js';

export type GenerateTextInput = {
  model: string;
  prompt: { system?: string; user: string };
  config?: { temperature?: number; maxOutputTokens?: number };
};

export type GenerateTextOutput = {
  content: string;
  tokensUsed?: number;
  model: string;
};

export type EmbedInput = {
  model: string;
  input: string[];
  taskType?: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY';
};

export type EmbedOutput = {
  model: string;
  embeddings: number[][];
};

export const geminiService = {
   async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const model = input.model || GEMINI_DEFAULTS.textModel;
    logDev('generateText:init', {
      model,
      hasSystemInstruction: !!input.prompt.system,
      userChars: input.prompt.user.length,
      temperature: input.config?.temperature ?? 0.3,
      maxOutputTokens: input.config?.maxOutputTokens ?? 1200,
    });
    const result = await geminiPost(`/models/${encodeURIComponent(model)}:generateContent`, {
      systemInstruction: input.prompt.system
        ? { parts: [{ text: input.prompt.system }] }
        : undefined,
      contents: [{ role: 'user', parts: [{ text: input.prompt.user }] }],
      generationConfig: {
        temperature: input.config?.temperature ?? 0.3,
        maxOutputTokens: input.config?.maxOutputTokens ?? 1200,
      },
    });

    const text = assertOkResponse(result);
    const data = parseJsonBody<Record<string, unknown>>(text);
    const usage = data.usageMetadata as { totalTokenCount?: number } | undefined;
    const content = extractText(data);
    if (!content) throw emptyResponseError();

    logDev('generateText:parsed', {
      model,
      contentChars: content.length,
      tokensUsed: usage?.totalTokenCount,
    });

    return {
      content,
      tokensUsed: usage?.totalTokenCount,
      model,
    };
  },

  async embedTexts(input: EmbedInput): Promise<EmbedOutput> {
    const model = input.model || GEMINI_DEFAULTS.embeddingModel;
    const taskType = input.taskType ?? 'RETRIEVAL_DOCUMENT';
    const modelPath = `models/${model}`;
    logDev('embedTexts:init', {
      model,
      taskType,
      inputCount: input.input.length,
      totalChars: input.input.reduce((sum, text) => sum + text.length, 0),
    });

    if (input.input.length === 1) {
      const result = await geminiPost(`/models/${encodeURIComponent(model)}:embedContent`, {
        model: modelPath,
        content: { parts: [{ text: input.input[0] }] },
        taskType,
      });
      const text = assertOkResponse(result);
      const data = parseJsonBody<Record<string, unknown>>(text);
      return { model, embeddings: [extractSingleEmbedding(data)] };
    }

    const result = await geminiPost(`/models/${encodeURIComponent(model)}:batchEmbedContents`, {
      requests: input.input.map((text) => ({
        model: modelPath,
        content: { parts: [{ text }] },
        taskType,
      })),
    });
    const text = assertOkResponse(result);
    const data = parseJsonBody<Record<string, unknown>>(text);
    return { model, embeddings: extractBatchEmbeddings(data, input.input.length) };
  },

  async checkHealth(): Promise<{ status: 'healthy' | 'unhealthy'; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      const model = GEMINI_DEFAULTS.textModel;
      const result = await geminiPost(`/models/${encodeURIComponent(model)}:generateContent`, {
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        generationConfig: { maxOutputTokens: 1 },
      });
      assertOkResponse(result);
      return { status: 'healthy', latencyMs: Date.now() - start };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - start,
      };
    }
  },
};

export { isRetryableGeminiError } from './gemini.errors.js';
