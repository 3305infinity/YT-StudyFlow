import { Router } from 'express';
import { z } from 'zod';
import { flashcardsController } from '../controllers/flashcards.controller.js';
import { validateBody } from '../middleware/validate.js';
import type { AuthedRequest } from '../middleware/auth.js';

const cardSchema = z.object({
  id: z.string().optional(),
  youtubeVideoId: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  tags: z.array(z.string()).optional(),
  sm2: z.unknown().optional(),
  nextReviewAt: z.string().nullable().optional(),
  playlistId: z.string().optional(),
  updatedAt: z.number().optional(),
});

const upsertSchema = z.union([
  z.object({ cards: z.array(cardSchema).min(1) }),
  cardSchema,
]);

const patchSchema = z
  .object({
    front: z.string().optional(),
    back: z.string().optional(),
    tags: z.array(z.string()).optional(),
    sm2: z.unknown().optional(),
    nextReviewAt: z.string().nullable().optional(),
    updatedAt: z.number().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const flashcardsRoutes = Router();

flashcardsRoutes.get('/', (req, res, next) => {
  flashcardsController.list(req as AuthedRequest, res).catch(next);
});

flashcardsRoutes.get('/:id', (req, res, next) => {
  flashcardsController.getById(req as unknown as AuthedRequest, res).catch(next);
});

flashcardsRoutes.post('/', validateBody(upsertSchema), (req, res, next) => {
  flashcardsController.upsert(req as AuthedRequest, res).catch(next);
});

flashcardsRoutes.patch('/:id', validateBody(patchSchema), (req, res, next) => {
  flashcardsController.update(req as unknown as AuthedRequest, res).catch(next);
});

flashcardsRoutes.delete('/:id', (req, res, next) => {
  flashcardsController.remove(req as unknown as AuthedRequest, res).catch(next);
});
