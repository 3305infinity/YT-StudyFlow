import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { playlistsService } from '../services/playlists.service.js';

export const playlistsController = {
  async list(req: AuthedRequest, res: Response): Promise<void> {
    res.json({ playlists: await playlistsService.list(req.userId) });
  },

  async getById(req: AuthedRequest, res: Response): Promise<void> {
    res.json({ playlist: await playlistsService.getById(req.userId, req.params.id) });
  },

  async upsert(req: AuthedRequest, res: Response): Promise<void> {
    res.status(201).json({ playlist: await playlistsService.upsert(req.userId, req.body) });
  },

  async update(req: AuthedRequest, res: Response): Promise<void> {
    res.json({ playlist: await playlistsService.update(req.userId, req.params.id, req.body) });
  },

  async remove(req: AuthedRequest, res: Response): Promise<void> {
    await playlistsService.remove(req.userId, req.params.id);
    res.status(204).send();
  },
};
