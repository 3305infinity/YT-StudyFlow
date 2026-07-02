import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { studySessionsService } from '../services/studySessions.service.js';

export const studySessionsController = {
  async list(req: AuthedRequest, res: Response): Promise<void> {
    res.json({
      sessions: await studySessionsService.list(
        req.userId,
        req.query.playlistId as string | undefined
      ),
    });
  },

  async getById(req: AuthedRequest, res: Response): Promise<void> {
    res.json({ session: await studySessionsService.getById(req.userId, req.params.id) });
  },

  async upsert(req: AuthedRequest, res: Response): Promise<void> {
    res.status(201).json({ session: await studySessionsService.upsert(req.userId, req.body) });
  },

  async update(req: AuthedRequest, res: Response): Promise<void> {
    res.json({ session: await studySessionsService.update(req.userId, req.params.id, req.body) });
  },

  async remove(req: AuthedRequest, res: Response): Promise<void> {
    await studySessionsService.remove(req.userId, req.params.id);
    res.status(204).send();
  },
};
