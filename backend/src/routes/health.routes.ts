import { Router } from 'express';
import { env } from '../config/env.js';
import { groqModel } from '../services/groq.service.js';
import { GEMINI_DEFAULTS } from '../services/gemini/gemini.config.js';

export const healthRoutes = Router();

/**
 * Liveness probe for Render.
 *
 * Must stay synchronous and dependency-free: no database, no Pinecone, no AI provider
 * calls. Render marks a service unhealthy if this is slow, and on the free tier a cold
 * start already costs ~30-60s before the first request is served.
 */
healthRoutes.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'YT StudyFlow Backend',
    uptimeSeconds: Math.round(process.uptime()),
  });
});

/**
 * Readiness/config probe.
 *
 * Reports whether each provider is *configured*, deliberately without calling any of
 * them — so it stays fast, costs nothing, and cannot be used to burn API quota.
 * Never returns key material, only booleans and non-secret model/index names.
 */
healthRoutes.get('/deep', (_req, res) => {
  const checks = {
    groq: {
      configured: !!env.groqApiKey,
      model: groqModel(),
      role: 'text generation',
    },
    gemini: {
      configured: !!env.geminiApiKey,
      model: GEMINI_DEFAULTS.embeddingModel,
      role: 'embeddings only',
    },
    pinecone: {
      configured: !!env.pineconeApiKey,
      index: env.pineconeIndex,
      namespace: env.pineconeNamespace || null,
      role: 'vector storage',
    },
    database: {
      configured: !!env.databaseUrl,
      role: 'optional cloud sync',
    },
  };

  // The database is optional; the three AI providers are not.
  const ready = checks.groq.configured && checks.gemini.configured && checks.pinecone.configured;

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not-ready',
    environment: env.nodeEnv,
    extensionIdConfigured: !!env.extensionId,
    checks,
  });
});
