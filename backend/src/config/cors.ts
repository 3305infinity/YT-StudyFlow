import type { CorsOptions } from 'cors';
import { env } from './env.js';

/** Local dev origins — only trusted when the backend is not running in production. */
const DEV_ALLOWED = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
]);

const YOUTUBE_ALLOWED = new Set(['https://www.youtube.com', 'https://youtube.com']);

/** chrome-extension origin for our published extension, when EXTENSION_ID is configured. */
function extensionOrigin(): string | null {
  return env.extensionId ? `chrome-extension://${env.extensionId}` : null;
}

function isAllowedOrigin(origin: string | undefined): boolean {
  // Same-origin / non-browser clients (curl, health checks) send no Origin header.
  if (!origin) return true;

  if (YOUTUBE_ALLOWED.has(origin)) return true;
  if (!env.isProd && DEV_ALLOWED.has(origin)) return true;

  const extOrigin = extensionOrigin();
  if (extOrigin) {
    // EXTENSION_ID is set: only that one extension is trusted.
    if (origin === extOrigin) return true;
  } else if (origin.startsWith('chrome-extension://')) {
    // No EXTENSION_ID configured yet (e.g. unpacked local testing).
    return true;
  }

  return env.corsOrigins.includes(origin);
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Install-Id'],
};
