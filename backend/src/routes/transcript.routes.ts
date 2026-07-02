import { Router } from 'express';
import { z } from 'zod';
import { transcriptController } from '../controllers/transcript.controller.js';
import { validateBody } from '../middleware/validate.js';
import { enforceDailyQuota } from '../middleware/rateLimit.js';
import type { AuthedRequest } from '../middleware/auth.js';

const translateSchema = z.object({
  videoId: z.string().min(1),
  targetLanguage: z.string().optional(),
  sourceLanguage: z.string().optional(),
  chunks: z
    .array(
      z.object({
        id: z.string().min(1),
        text: z.string(),
        startTime: z.number(),
        endTime: z.number(),
        duration: z.number(),
        index: z.number(),
      })
    )
    .min(1)
    .max(500),
});

export const transcriptRoutes = Router();

transcriptRoutes.post(
  '/translate',
  enforceDailyQuota,
  validateBody(translateSchema),
  (req, res, next) => {
    transcriptController.translate(req as AuthedRequest, res).catch(next);
  }
);
