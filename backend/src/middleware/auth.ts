import type { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../lib/authUtils.js';
import { GUEST_USER_ID } from '../config/auth.config.js';

export type AuthedRequest = Request & {
  userId: string;
  userEmail?: string;
  userName?: string;
  userImageUrl?: string;
};

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

      // 2. Dev mode token fallback (dev:<userId>)
      if (token.startsWith('dev:')) {
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

  // 3. Fallback for guest mode if no auth token is passed
  const authed = req as AuthedRequest;
  authed.userId = GUEST_USER_ID;
  authed.userEmail = 'guest@local.dev';
  authed.userName = 'Guest';
  next();
}
