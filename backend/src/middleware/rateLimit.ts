import type { Request, Response, NextFunction } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';
import { anonymousUserId, type AuthedRequest } from './auth.js';
import { AppError } from '../utils/appError.js';
import { usageRepository } from '../repositories/usage.repository.js';

const TOO_MANY_REQUESTS = {
  error: 'TooManyRequests',
  message: 'Too many requests. Please wait a moment and try again.',
};

/**
 * Per-user limiter: one bucket per signed-in user, or per extension install
 * (X-Install-Id) for anonymous callers.
 */
export const globalRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  limit: env.rateLimitMaxPerWindow,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthedRequest).userId ?? anonymousUserId(req),
  message: TOO_MANY_REQUESTS,
});

/**
 * Per-IP limiter with a higher ceiling, applied in addition to the per-install one.
 * Stops a single host from minting unlimited install ids to bypass the limit above.
 * `ipKeyGenerator` normalises IPv6 addresses to a /56 subnet so rotating within a
 * block does not reset the counter.
 */
export const ipRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  limit: env.ipRateLimitMaxPerWindow,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? 'unknown'),
  message: TOO_MANY_REQUESTS,
});

export async function enforceDailyQuota(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as AuthedRequest).userId;
  if (!userId) return next();

  try {
    const count = await usageRepository.countToday(userId);
    if (count >= env.dailyQuotaMax) {
      next(
        new AppError(
          429,
          'Daily AI quota reached. Try again tomorrow or upgrade your plan.',
          undefined,
          'DailyQuotaExceeded'
        )
      );
      return;
    }
    next();
  } catch {
    next();
  }
}

export async function recordUsage(req: Request, action: string): Promise<void> {
  const userId = (req as AuthedRequest).userId;
  if (!userId) return;
  await usageRepository.record(userId, action);
}
