import type { CorsOptions } from 'cors';
import { env } from './env.js';

const STATIC_ALLOWED = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'https://www.youtube.com',
  'https://youtube.com',
]);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (STATIC_ALLOWED.has(origin)) return true;
  if (origin.startsWith('chrome-extension://')) return true;
  if (env.corsOrigins.includes('*')) return true;
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
  allowedHeaders: ['Content-Type', 'Authorization'],
};
