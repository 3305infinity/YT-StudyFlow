import { env } from '../../config/env.js';

export function ragDevLog(label: string, detail: Record<string, unknown>): void {
  if (env.nodeEnv !== 'development') return;
  console.debug(`[rag:dev] ${label}`, detail);
}
