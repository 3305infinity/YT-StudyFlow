import { Router } from 'express';
import { z } from 'zod';
import { aiController } from '../controllers/ai.controller.js';
import { validateBody } from '../middleware/validate.js';
import { enforceDailyQuota } from '../middleware/rateLimit.js';
import type { AuthedRequest } from '../middleware/auth.js';

const generateSchema = z.object({
  model: z.string().min(1),
  prompt: z.object({
    system: z.string().optional(),
    user: z.string().min(1).max(120_000),
  }),
  config: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxOutputTokens: z.number().int().min(1).max(8192).optional(),
    })
    .optional(),
});

const embedSchema = z.object({
  model: z.string().min(1),
  input: z.array(z.string().min(1)).min(1).max(64),
  taskType: z
    .enum(['RETRIEVAL_DOCUMENT', 'RETRIEVAL_QUERY', 'SEMANTIC_SIMILARITY'])
    .optional(),
});

const transformLanguageSchema = z.object({
  content: z.string().min(1).max(50_000),
  targetLanguage: z.string().min(1),
});

export const aiRoutes = Router();

aiRoutes.post(
  '/generate',
  enforceDailyQuota,
  validateBody(generateSchema),
  (req, res, next) => {
    aiController.generate(req as AuthedRequest, res).catch(next);
  }
);

aiRoutes.post('/embed', enforceDailyQuota, validateBody(embedSchema), (req, res, next) => {
  aiController.embed(req as AuthedRequest, res).catch(next);
});

aiRoutes.post(
  '/transform-language',
  enforceDailyQuota,
  validateBody(transformLanguageSchema),
  (req, res, next) => {
    aiController.transformLanguage(req as AuthedRequest, res).catch(next);
  }
);

aiRoutes.get('/health', (req, res, next) => {
  aiController.health(req as AuthedRequest, res).catch(next);
});

export { recordUsage } from '../middleware/rateLimit.js';
