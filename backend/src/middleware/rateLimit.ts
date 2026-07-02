import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import type { AuthedRequest } from './auth.js';
import { AppError } from '../utils/appError.js';
import { usageRepository } from '../repositories/usage.repository.js';

export const globalRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMaxPerWindow,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthedRequest).userId ?? req.ip ?? 'anon',
  message: {
    error: 'TooManyRequests',
    message: 'Too many requests. Please wait a moment and try again.',
  },
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
