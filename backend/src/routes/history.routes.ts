import { Router } from 'express';
import { z } from 'zod';
import { historyController } from '../controllers/history.controller.js';
import { validateBody } from '../middleware/validate.js';
import type { AuthedRequest } from '../middleware/auth.js';

const messageSchema = z.object({
  id: z.string().optional(),
  youtubeVideoId: z.string().optional(),
  role: z.string().min(1),
  content: z.string(),
  citations: z.unknown().optional(),
  mode: z.string().optional(),
  model: z.string().optional(),
  updatedAt: z.number().optional(),
});

const upsertSchema = z.union([
  z.object({ messages: z.array(messageSchema).min(1) }),
  messageSchema,
]);

const patchSchema = z
  .object({
    content: z.string().optional(),
    citations: z.unknown().optional(),
    mode: z.string().optional(),
    model: z.string().optional(),
    updatedAt: z.number().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const historyRoutes = Router();

historyRoutes.get('/', (req, res, next) => {
  historyController.list(req as AuthedRequest, res).catch(next);
});

historyRoutes.delete('/', (req, res, next) => {
  if (req.query.videoId) {
    historyController.removeByVideo(req as AuthedRequest, res).catch(next);
    return;
  }
  res.status(400).json({ error: 'videoId query parameter required' });
});

historyRoutes.get('/:id', (req, res, next) => {
  historyController.getById(req as unknown as AuthedRequest, res).catch(next);
});

historyRoutes.post('/', validateBody(upsertSchema), (req, res, next) => {
  historyController.upsert(req as AuthedRequest, res).catch(next);
});

historyRoutes.patch('/:id', validateBody(patchSchema), (req, res, next) => {
  historyController.update(req as unknown as AuthedRequest, res).catch(next);
});

historyRoutes.delete('/:id', (req, res, next) => {
  historyController.remove(req as unknown as AuthedRequest, res).catch(next);
});
