import { Router } from 'express';
import { z } from 'zod';
import { playlistsController } from '../controllers/playlists.controller.js';
import { validateBody } from '../middleware/validate.js';
import type { AuthedRequest } from '../middleware/auth.js';

const upsertSchema = z.object({
  id: z.string().optional(),
  youtubeId: z.string().min(1),
  title: z.string().optional(),
  videoIds: z.array(z.string()).optional(),
  updatedAt: z.number().optional(),
});

const patchSchema = z
  .object({
    title: z.string().optional(),
    videoIds: z.array(z.string()).optional(),
    updatedAt: z.number().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const playlistsRoutes = Router();

playlistsRoutes.get('/', (req, res, next) => {
  playlistsController.list(req as AuthedRequest, res).catch(next);
});

playlistsRoutes.get('/:id', (req, res, next) => {
  playlistsController.getById(req as unknown as AuthedRequest, res).catch(next);
});

playlistsRoutes.post('/', validateBody(upsertSchema), (req, res, next) => {
  playlistsController.upsert(req as AuthedRequest, res).catch(next);
});

playlistsRoutes.patch('/:id', validateBody(patchSchema), (req, res, next) => {
  playlistsController.update(req as unknown as AuthedRequest, res).catch(next);
});

playlistsRoutes.delete('/:id', (req, res, next) => {
  playlistsController.remove(req as unknown as AuthedRequest, res).catch(next);
});
