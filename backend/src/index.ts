import { createApp } from './app.js';
import { env, assertRuntimeConfig } from './config/env.js';
import { GEMINI_API_BASE, GEMINI_DEFAULTS } from './services/gemini/gemini.config.js';

assertRuntimeConfig();

const app = createApp();

const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`[yt-studyflow-backend] listening on 0.0.0.0:${env.port}`);
  if (env.nodeEnv === 'development') {
    console.log('[yt-studyflow-backend] Gemini config', {
      endpoint: GEMINI_API_BASE,
      textModel: GEMINI_DEFAULTS.textModel,
      embeddingModel: GEMINI_DEFAULTS.embeddingModel,
      apiKeyLoaded: !!env.geminiApiKey,
    });
  }
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[yt-studyflow-backend] Port ${env.port} is already in use. Stop the existing backend process or set PORT to another value.`
    );
    process.exit(1);
  }

  console.error('[yt-studyflow-backend] Server failed to start', err);
  process.exit(1);
});
