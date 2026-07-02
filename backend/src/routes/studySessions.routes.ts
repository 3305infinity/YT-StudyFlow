import { Router } from 'express';
import { z } from 'zod';
import { studySessionsController } from '../controllers/studySessions.controller.js';
import { validateBody } from '../middleware/validate.js';
import type { AuthedRequest } from '../middleware/auth.js';

const upsertSchema = z.object({
  id: z.string().optional(),
  playlistId: z.string().optional(),
  topic: z.string().min(1),
  level: z.string().optional(),
  payload: z.unknown(),
  updatedAt: z.number().optional(),
});

const patchSchema = z
  .object({
    playlistId: z.string().optional(),
    topic: z.string().optional(),
    level: z.string().optional(),
    payload: z.unknown().optional(),
    updatedAt: z.number().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const studySessionsRoutes = Router();

studySessionsRoutes.get('/', (req, res, next) => {
  studySessionsController.list(req as AuthedRequest, res).catch(next);
});

studySessionsRoutes.get('/:id', (req, res, next) => {
  studySessionsController.getById(req as unknown as AuthedRequest, res).catch(next);
});

studySessionsRoutes.post('/', validateBody(upsertSchema), (req, res, next) => {
  studySessionsController.upsert(req as AuthedRequest, res).catch(next);
});

studySessionsRoutes.patch('/:id', validateBody(patchSchema), (req, res, next) => {
  studySessionsController.update(req as unknown as AuthedRequest, res).catch(next);
});

studySessionsRoutes.delete('/:id', (req, res, next) => {
  studySessionsController.remove(req as unknown as AuthedRequest, res).catch(next);
});
