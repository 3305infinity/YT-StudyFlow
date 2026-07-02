import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { userRepository } from '../repositories/user.repository.js';
import { usageRepository } from '../repositories/usage.repository.js';
import { env } from '../config/env.js';

export const authController = {
  async me(req: AuthedRequest, res: Response): Promise<void> {
    const used = await usageRepository.countToday(req.userId);

    if (process.env.DATABASE_URL) {
      await userRepository.upsertFromClerk({
        id: req.userId,
        email: req.userEmail,
        name: req.userName,
        imageUrl: req.userImageUrl,
      });
    }

    res.json({
      userId: req.userId,
      email: req.userEmail ?? null,
      name: req.userName ?? null,
      imageUrl: req.userImageUrl ?? null,
      usage: {
        used,
        limit: env.dailyQuotaMax,
        remaining: Math.max(0, env.dailyQuotaMax - used),
      },
    });
  },

  async usage(req: AuthedRequest, res: Response): Promise<void> {
    const used = await usageRepository.countToday(req.userId);
    res.json({
      used,
      limit: env.dailyQuotaMax,
      remaining: Math.max(0, env.dailyQuotaMax - used),
    });
  },
};
