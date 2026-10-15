import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyAuthToken } from '../lib/authUtils.js';
import { ANON_IP_PREFIX, ANON_USER_PREFIX, GUEST_USER_ID } from '../config/auth.config.js';
import { env } from '../config/env.js';

export type AuthedRequest = Request & {
  userId: string;
  userEmail?: string;
  userName?: string;
  userImageUrl?: string;
};

export const INSTALL_ID_HEADER = 'x-install-id';

const installIdSchema = z.string().trim().uuid();

/**
 * Identity for unauthenticated callers.
 *
 * Each extension install sends a random UUID in X-Install-Id, so quotas, rate limits
 * and stored data are scoped per installation. Callers without a usable install id
 * fall back to their IP — never to a single shared guest user.
 */
export function anonymousUserId(req: Request): string {
  const raw = req.headers[INSTALL_ID_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = installIdSchema.safeParse(value ?? '');

  if (parsed.success) {
    return `${ANON_USER_PREFIX}${parsed.data.toLowerCase()}`;
  }

  return `${ANON_IP_PREFIX}${req.ip ?? 'unknown'}`;
}

export const clerkAuthMiddleware = (_req: Request, _res: Response, next: NextFunction) => next();

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  if (header?.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    if (token) {
      // 1. Try native JWT token verification first
      const payload = verifyAuthToken(token);
      if (payload) {
        const authed = req as AuthedRequest;
        authed.userId = payload.userId;
        authed.userEmail = payload.email;
        authed.userName = payload.name;
        next();
        return;
      }

      // 2. Dev mode token fallback (dev:<userId>) - strictly disabled in production unless ALLOW_DEV_AUTH=true
      const allowDevAuth = process.env.ALLOW_DEV_AUTH === 'true' || !env.isProd;
      if (token.startsWith('dev:') && allowDevAuth) {
        const devUserId = token.slice(4).trim() || GUEST_USER_ID;
        const authed = req as AuthedRequest;
        authed.userId = devUserId;
        authed.userEmail = `${devUserId}@local.dev`;
        authed.userName = 'Developer';
        next();
        return;
      }
    }
  }

  // 3. Anonymous mode: identify per installation (or per IP), never one shared user.
  const authed = req as AuthedRequest;
  authed.userId = anonymousUserId(req);
  authed.userName = 'Guest';
  next();
}
