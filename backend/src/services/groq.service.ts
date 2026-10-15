import { env } from '../config/env.js';
import { AppError } from '../utils/appError.js';
import { ragDevLog } from './rag/devLog.js';

/**
 * The single text-generation service for the backend.
 *
 * Every text generation path goes through here: chat answers, /api/ai/generate
 * (notes, chapters, flashcards, quizzes, study agent), and translation.
 * Gemini is used only for embeddings — see embedding.service.ts.
 */

export type GroqGenerateTextInput = {
  /** Defaults to env.groqModel. A Gemini model id passed by an older client is ignored. */
  model?: string;
  prompt: { system?: string; user: string };
  config?: {
    temperature?: number;
    maxOutputTokens?: number;
    /** Ask Groq for a strict JSON object response. Falls back to prompt-only JSON. */
    jsonMode?: boolean;
  };
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
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Rate-limit retry policy. */
const MAX_RATE_LIMIT_RETRIES = 2;
const BASE_BACKOFF_MS = 600;
/** Never hold a request longer than this waiting out a 429; fail fast instead. */
const MAX_RETRY_WAIT_MS = 20_000;

/** Max simultaneous in-flight Groq requests, so batch work cannot burst the quota. */
const MAX_CONCURRENT_REQUESTS = 3;

/** Rough chars-per-token ratio used to size translation batches. */
export const GROQ_CHARS_PER_TOKEN = 4;

export function groqModel(): string {
  return env.groqModel || DEFAULT_MODEL;
}

// ---------------------------------------------------------------------------
// Concurrency gate
// ---------------------------------------------------------------------------

let activeRequests = 0;
const waiters: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  // The releasing caller handed its slot over; activeRequests stays unchanged.
}

function releaseSlot(): void {
  const next = waiters.shift();
  if (next) next();
  else activeRequests--;
}

/**
 * Runs tasks with the same concurrency cap as Groq requests, preserving input order.
 * Use when generating many items at once (quiz + flashcards, translation batches).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  limit = MAX_CONCURRENT_REQUESTS
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!, index);
    }
  });

  await Promise.all(runners);
  return results;
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

export function groqRateLimitError(): AppError {
  // Same shape the express-rate-limit middleware returns, so clients handle one format.
  return new AppError(
    429,
    'Too many requests. Please wait a moment and try again.',
    undefined,
    'TooManyRequests'
  );
}

/** Parses Groq reset durations like "7.66s", "2m59.56s", "120ms". */
function parseDurationMs(raw: string): number | null {
  const match = raw.trim().match(/^(?:(\d+(?:\.\d+)?)m(?!s))?(?:(\d+(?:\.\d+)?)s)?(?:(\d+)ms)?$/);
  if (!match) return null;
  const [, minutes, seconds, millis] = match;
  if (!minutes && !seconds && !millis) return null;
  return (
    (minutes ? Number(minutes) * 60_000 : 0) +
    (seconds ? Number(seconds) * 1000 : 0) +
    (millis ? Number(millis) : 0)
  );
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }

  for (const name of ['x-ratelimit-reset-requests', 'x-ratelimit-reset-tokens']) {
    const value = response.headers.get(name);
    if (value) {
      const ms = parseDurationMs(value);
      if (ms !== null) return ms;
    }
  }

  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Model discovery fallback
// ---------------------------------------------------------------------------

async function fetchLiveProductionModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<{ id: string }> };
    if (!Array.isArray(data.data)) return [];

    const chatIds = data.data
      .map((m) => m.id)
      .filter((id) => {
        const lower = id.toLowerCase();
        return (
          !lower.includes('whisper') &&
          !lower.includes('prompt-guard') &&
          !lower.includes('safeguard') &&
          !lower.includes('orpheus') &&
          !lower.includes('specdec')
        );
      });

    const prefOrder = [
      'openai/gpt-oss-20b',
      'openai/gpt-oss-120b',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
    ];
    return chatIds.sort((a, b) => {
      const ia = prefOrder.indexOf(a);
      const ib = prefOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return 0;
    });
  } catch (err) {
    ragDevLog('groq:fetch-models-error', { error: String(err) });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

type PostResult =
  | { kind: 'ok'; data: GroqChatResponse }
  | { kind: 'model-error'; status: number; body: string }
  | { kind: 'error'; status: number; body: string };

type GroqChatResponse = {
  model?: string;
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

/** One model attempt, including 429 backoff. Throws AppError(429) when out of retries. */
async function postChatCompletion(
  apiKey: string,
  body: Record<string, unknown>,
  label: string
): Promise<PostResult> {
  for (let attempt = 0; ; attempt++) {
    await acquireSlot();
    let response: Response;
    try {
      response = await fetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } finally {
      releaseSlot();
    }

    if (response.status === 429) {
      const advised = retryAfterMs(response);
      const backoff = BASE_BACKOFF_MS * 2 ** attempt;
      const waitMs = advised ?? backoff;

      if (attempt >= MAX_RATE_LIMIT_RETRIES || waitMs > MAX_RETRY_WAIT_MS) {
        ragDevLog('groq:rate-limited', {
          label,
          attempt,
          waitMs,
          giveUp: true,
        });
        throw groqRateLimitError();
      }

      ragDevLog('groq:rate-limited', { label, attempt, waitMs, giveUp: false });
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      const decommissioned =
        response.status === 404 ||
        response.status === 400 ||
        text.includes('model_not_found') ||
        text.includes('decommissioned');
      return decommissioned
        ? { kind: 'model-error', status: response.status, body: text }
        : { kind: 'error', status: response.status, body: text };
    }

    return { kind: 'ok', data: (await response.json()) as GroqChatResponse };
  }
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

/** Strips ```json fences / prose and returns the first balanced JSON value. */
export function stripJsonFences(raw: string): string {
  let text = raw.trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) text = fenced[1].trim();

  if (text.startsWith('{') || text.startsWith('[')) return text;

  const firstObject = text.indexOf('{');
  const firstArray = text.indexOf('[');
  const start =
    firstObject === -1 ? firstArray : firstArray === -1 ? firstObject : Math.min(firstObject, firstArray);
  if (start === -1) return text;

  const open = text[start] === '{' ? '{' : '[';
  const close = open === '{' ? '}' : ']';
  const end = text.lastIndexOf(close);
  return end > start ? text.slice(start, end + 1) : text.slice(start);
}

export function parseJsonLoose<T>(raw: string): T {
  const candidate = stripJsonFences(raw);
  return JSON.parse(candidate) as T;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const groqService = {
  async generateText(input: GroqGenerateTextInput): Promise<GroqGenerateTextOutput> {
    const apiKey = env.groqApiKey;
    if (!apiKey) {
      ragDevLog('groq:error', { reason: 'GROQ_API_KEY is not set in environment.' });
      throw new AppError(
        503,
        'AI text generation is not configured. Please try again later.',
        undefined,
        'GroqNotConfigured'
      );
    }

    // An older client may still send a Gemini model id; Gemini is embeddings-only now.
    const requested = input.model?.trim();
    const configuredModel =
      requested && !requested.toLowerCase().startsWith('gemini') ? requested : groqModel();

    const temperature = input.config?.temperature ?? 0.3;
    const maxTokens = input.config?.maxOutputTokens ?? 1800;
    const wantsJson = input.config?.jsonMode === true;

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (input.prompt.system) messages.push({ role: 'system', content: input.prompt.system });
    messages.push({ role: 'user', content: input.prompt.user });

    const modelsToTry = [configuredModel];
    const failedModels = new Set<string>();
    let liveFetched = false;
    let lastError: Error | null = null;
    /** Set when the model rejects response_format, so we retry prompt-only JSON. */
    let allowJsonMode = wantsJson;

    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i]!;
      if (failedModels.has(model)) continue;

      const body: Record<string, unknown> = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      };
      if (allowJsonMode) body.response_format = { type: 'json_object' };

      ragDevLog('groq:request', {
        model,
        userPromptChars: input.prompt.user.length,
        hasSystemInstruction: !!input.prompt.system,
        temperature,
        maxTokens,
        jsonMode: allowJsonMode,
      });

      const startTime = Date.now();
      let result: PostResult;
      try {
        result = await postChatCompletion(apiKey, body, model);
      } catch (err) {
        // AppError(429) from the rate limiter must reach the client unchanged.
        if (err instanceof AppError) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
        failedModels.add(model);
        ragDevLog('groq:request-failed', { model, error: String(err) });
        continue;
      }

      if (result.kind !== 'ok') {
        ragDevLog('groq:api-error', { model, status: result.status, body: result.body });

        // Some models reject response_format; retry the same model without JSON mode.
        if (allowJsonMode && /response_format|json_object/i.test(result.body)) {
          ragDevLog('groq:json-mode-unsupported', { model });
          allowJsonMode = false;
          i--;
          continue;
        }

        lastError = new Error(`Groq model "${model}" returned HTTP ${result.status}: ${result.body}`);
        failedModels.add(model);

        if (result.kind === 'model-error' && !liveFetched) {
          liveFetched = true;
          const liveModels = await fetchLiveProductionModels(apiKey);
          ragDevLog('groq:live-models-discovered', { count: liveModels.length });
          for (const live of liveModels) {
            if (!modelsToTry.includes(live) && !failedModels.has(live)) modelsToTry.push(live);
          }
        }
        continue;
      }

      const data = result.data;
      const content = data.choices?.[0]?.message?.content?.trim() ?? '';
      if (!content) {
        lastError = new Error(`Groq model "${model}" returned empty completion content.`);
        failedModels.add(model);
        ragDevLog('groq:empty-content', { model });
        continue;
      }

      const finalModel = data.model || model;
      ragDevLog('groq:generation-success', {
        model: finalModel,
        latencyMs: Date.now() - startTime,
        outputLength: content.length,
        tokensUsed: data.usage?.total_tokens,
        finishReason: data.choices?.[0]?.finish_reason || 'stop',
      });

      return {
        content,
        tokensUsed: data.usage?.total_tokens,
        model: finalModel,
        finishReason: data.choices?.[0]?.finish_reason || 'stop',
        promptTokenCount: data.usage?.prompt_tokens,
        candidatesTokenCount: data.usage?.completion_tokens,
        rawResponseLength: content.length,
      };
    }

    ragDevLog('groq:all-models-failed', { lastError: lastError?.message });
    throw new AppError(
      502,
      'The AI service is temporarily unavailable. Please try again.',
      undefined,
      'GroqGenerationFailed'
    );
  },

  /**
   * Text generation that must return JSON. Asks for strict JSON mode where the model
   * supports it, and always parses defensively through {@link stripJsonFences}.
   */
  async generateJson<T>(
    input: GroqGenerateTextInput
  ): Promise<{ data: T; raw: string; model: string; tokensUsed?: number }> {
    const system = [
      input.prompt.system,
      'Respond with a single valid JSON value and nothing else. No markdown fences, no commentary.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const result = await groqService.generateText({
      ...input,
      prompt: { system, user: input.prompt.user },
      config: { ...input.config, jsonMode: input.config?.jsonMode ?? true },
    });

    try {
      return {
        data: parseJsonLoose<T>(result.content),
        raw: result.content,
        model: result.model,
        tokensUsed: result.tokensUsed,
      };
    } catch (err) {
      ragDevLog('groq:json-parse-failed', {
        model: result.model,
        error: err instanceof Error ? err.message : String(err),
        preview: result.content.slice(0, 200),
      });
      throw new AppError(
        502,
        'The AI service returned an unreadable response. Please retry.',
        undefined,
        'GroqJsonParseFailed'
      );
    }
  },

  async checkHealth(): Promise<{ status: 'healthy' | 'unhealthy'; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      if (!env.groqApiKey) return { status: 'unhealthy', error: 'GROQ_API_KEY not configured' };
      await groqService.generateText({
        prompt: { user: 'ping' },
        config: { maxOutputTokens: 1, temperature: 0 },
      });
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
