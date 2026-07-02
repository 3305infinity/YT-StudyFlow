import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { notesService } from '../services/notes.service.js';

export const notesController = {
  async list(req: AuthedRequest, res: Response): Promise<void> {
    const youtubeVideoId = req.query.videoId as string | undefined;
    res.json({ notes: await notesService.list(req.userId, youtubeVideoId) });
  },

  async getById(req: AuthedRequest, res: Response): Promise<void> {
    res.json({ note: await notesService.getById(req.userId, req.params.id) });
  },

  async create(req: AuthedRequest, res: Response): Promise<void> {
    res.status(201).json({ note: await notesService.create(req.userId, req.body) });
  },

  async update(req: AuthedRequest, res: Response): Promise<void> {
    res.json({ note: await notesService.update(req.userId, req.params.id, req.body) });
  },

  async remove(req: AuthedRequest, res: Response): Promise<void> {
    await notesService.remove(req.userId, req.params.id);
    res.status(204).send();
  },
};
