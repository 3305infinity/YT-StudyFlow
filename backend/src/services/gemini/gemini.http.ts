import { GEMINI_API_BASE, GEMINI_DEFAULTS, getGeminiApiKey, logDev } from './gemini.config.js';
import {
  isRetryableGeminiError,
  parseGeminiErrorBody,
  parseNetworkError,
  toAppError,
} from './gemini.errors.js';
import { AppError } from '../../utils/appError.js';

export type GeminiHttpResult = {
  ok: boolean;
  status: number;
  body: string;
};

async function geminiFetchOnce(path: string, body: unknown, apiKey: string): Promise<GeminiHttpResult> {
  const url = `${GEMINI_API_BASE}${path}?key=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_DEFAULTS.requestTimeoutMs);

  logDev('request', {
    path,
    modelPath: path.split('/models/')[1]?.split(':')[0],
    bodyBytes: JSON.stringify(body).length,
  });

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await resp.text();
    logDev('response', { path, status: resp.status, body: text });
    return { ok: resp.ok, status: resp.status, body: text };
  } catch (err) {
    logDev('network-failure', { path, error: err instanceof Error ? err.message : String(err) });
    throw toAppError(parseNetworkError(err));
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** POST to Gemini with timeout, dev logging, and retry for transient failures only. */
export async function geminiPost(path: string, body: unknown): Promise<GeminiHttpResult> {
  let apiKey: string;
  try {
    apiKey = getGeminiApiKey();
  } catch {
    throw new AppError(
      503,
      'AI service unavailable. Set GEMINI_API_KEY in backend/.env.',
      undefined,
      'MissingApiKey'
    );
  }

  let lastError: AppError | null = null;
  const maxAttempts = GEMINI_DEFAULTS.maxRetries + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await geminiFetchOnce(path, body, apiKey);
      if (result.ok) return result;

      const parsed = parseGeminiErrorBody(result.status, result.body);
      const appErr = toAppError(parsed);
      if (!parsed.retryable || attempt >= maxAttempts - 1) {
        throw appErr;
      }
      lastError = appErr;
    } catch (err) {
      if (err instanceof AppError) {
        if (!isRetryableGeminiError(err) || attempt >= maxAttempts - 1) throw err;
        lastError = err;
      } else {
        const net = toAppError(parseNetworkError(err));
        if (attempt >= maxAttempts - 1) throw net;
        lastError = net;
      }
    }

    const delay = GEMINI_DEFAULTS.retryBaseDelayMs * (attempt + 1);
    logDev('retry', { path, attempt: attempt + 1, delayMs: delay, lastCode: lastError?.code });
    await sleep(delay);
  }

  throw lastError ?? new AppError(503, 'AI request failed.', undefined, 'GeminiError');
}

export function assertOkResponse(result: GeminiHttpResult): string {
  if (!result.ok) {
    throw toAppError(parseGeminiErrorBody(result.status, result.body));
  }
  return result.body;
}
