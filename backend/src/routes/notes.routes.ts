import { Router } from 'express';
import { z } from 'zod';
import { notesController } from '../controllers/notes.controller.js';
import { validateBody } from '../middleware/validate.js';
import type { AuthedRequest } from '../middleware/auth.js';

const createSchema = z.object({
  youtubeVideoId: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  content: z.string(),
  tags: z.array(z.string()).optional(),
  anchors: z.unknown().optional(),
  videoTitle: z.string().optional(),
});

const patchSchema = z
  .object({
    type: z.string().optional(),
    title: z.string().optional(),
    content: z.string().optional(),
    tags: z.array(z.string()).optional(),
    anchors: z.unknown().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const notesRoutes = Router();

notesRoutes.get('/', (req, res, next) => {
  notesController.list(req as AuthedRequest, res).catch(next);
});

notesRoutes.get('/:id', (req, res, next) => {
  notesController.getById(req as unknown as AuthedRequest, res).catch(next);
});

notesRoutes.post('/', validateBody(createSchema), (req, res, next) => {
  notesController.create(req as AuthedRequest, res).catch(next);
});

notesRoutes.patch('/:id', validateBody(patchSchema), (req, res, next) => {
  notesController.update(req as unknown as AuthedRequest, res).catch(next);
});

notesRoutes.delete('/:id', (req, res, next) => {
  notesController.remove(req as unknown as AuthedRequest, res).catch(next);
});
