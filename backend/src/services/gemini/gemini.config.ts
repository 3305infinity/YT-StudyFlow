import { env } from '../../config/env.js';

/** Gemini REST API base — v1beta supports current models and embeddings. */
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const GEMINI_DEFAULTS = {
  // Embeddings only — text generation runs on Groq (services/groq.service.ts).
  embeddingModel: 'gemini-embedding-001',
  requestTimeoutMs: 30_000,
  maxRetries: 2,
  retryBaseDelayMs: 400,
} as const;

export function getGeminiApiKey(): string {
  const key = env.geminiApiKey?.trim();
  if (!key) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return key;
}

export function isDevMode(): boolean {
  return env.nodeEnv === 'development';
}

export function logDev(label: string, detail: Record<string, unknown>): void {
  if (!isDevMode()) return;
  console.debug(`[gemini:dev] ${label}`, detail);
}
