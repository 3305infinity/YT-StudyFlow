import { isRetryableGeminiError } from '../services/gemini.service.js';

export type RetryOptions = {
  retries?: number;
  delayMs?: number;
  label?: string;
  /** When omitted, only transient Gemini/network errors are retried. */
  shouldRetry?: (err: unknown) => boolean;
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 2, delayMs = 400, label = 'operation', shouldRetry }: RetryOptions = {}
): Promise<T> {
  const canRetry = shouldRetry ?? isRetryableGeminiError;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= retries || !canRetry(err)) break;
      console.warn(`[retry] ${label} failed (attempt ${attempt + 1}/${retries + 1})`, err);
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}
