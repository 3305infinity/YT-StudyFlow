import { Router } from 'express';
import { z } from 'zod';
import { quizzesController } from '../controllers/quizzes.controller.js';
import { validateBody } from '../middleware/validate.js';
import type { AuthedRequest } from '../middleware/auth.js';

const upsertSchema = z.object({
  id: z.string().optional(),
  youtubeVideoId: z.string().min(1),
  mode: z.string().min(1),
  questions: z.unknown(),
  videoTitle: z.string().optional(),
  updatedAt: z.number().optional(),
});

const patchSchema = z
  .object({
    mode: z.string().optional(),
    questions: z.unknown().optional(),
    updatedAt: z.number().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const quizzesRoutes = Router();

quizzesRoutes.get('/', (req, res, next) => {
  quizzesController.list(req as AuthedRequest, res).catch(next);
});

quizzesRoutes.get('/:id', (req, res, next) => {
  quizzesController.getById(req as unknown as AuthedRequest, res).catch(next);
});

quizzesRoutes.post('/', validateBody(upsertSchema), (req, res, next) => {
  quizzesController.upsert(req as AuthedRequest, res).catch(next);
});

quizzesRoutes.patch('/:id', validateBody(patchSchema), (req, res, next) => {
  quizzesController.update(req as unknown as AuthedRequest, res).catch(next);
});

quizzesRoutes.delete('/:id', (req, res, next) => {
  quizzesController.remove(req as unknown as AuthedRequest, res).catch(next);
});
