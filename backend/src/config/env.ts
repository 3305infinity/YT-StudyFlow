import 'dotenv/config';
import { AUTH_DISABLED } from './auth.config.js';

function required(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required env var: ${name}`);
    }
    return '';
  }
  return value.trim();
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  corsOrigins: (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  clerkSecretKey: process.env.CLERK_SECRET_KEY?.trim() ?? '',
  clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY?.trim() ?? '',
  geminiApiKey: required('GEMINI_API_KEY', process.env.GEMINI_API_KEY),
  pineconeApiKey: process.env.PINECONE_API_KEY?.trim() ?? '',
  pineconeIndex: process.env.PINECONE_INDEX?.trim() ?? 'yt-studyflow',
  pineconeNamespace: process.env.PINECONE_NAMESPACE?.trim() ?? '',
  databaseUrl: process.env.DATABASE_URL?.trim() ?? '',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  rateLimitMaxPerWindow: Number(process.env.RATE_LIMIT_MAX_PER_WINDOW ?? 30),
  dailyQuotaMax: Number(process.env.DAILY_QUOTA_MAX ?? 200),
} as const;

export function assertRuntimeConfig(): void {
  if (env.isProd && !env.geminiApiKey) {
    throw new Error('GEMINI_API_KEY is required in production');
  }

  if (env.isProd && !env.pineconeApiKey) {
    throw new Error('PINECONE_API_KEY is required in production for Pinecone-backed RAG');
  }

  // TODO: Re-enable this Clerk requirement when AUTH_DISABLED=false for the auth phase.
  if (env.isProd && !AUTH_DISABLED && !env.clerkSecretKey) {
    throw new Error('CLERK_SECRET_KEY is required in production when auth is enabled');
  }

  if (env.isProd && !env.databaseUrl) {
    console.warn('[backend] DATABASE_URL not set - persistence disabled');
  }
}
