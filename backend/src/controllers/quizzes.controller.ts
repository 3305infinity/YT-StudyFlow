import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { quizzesService } from '../services/quizzes.service.js';

export const quizzesController = {
  async list(req: AuthedRequest, res: Response): Promise<void> {
    res.json({
      quizzes: await quizzesService.list(req.userId, req.query.videoId as string | undefined),
    });
  },

  async getById(req: AuthedRequest, res: Response): Promise<void> {
    res.json({ quiz: await quizzesService.getById(req.userId, req.params.id) });
  },

  async upsert(req: AuthedRequest, res: Response): Promise<void> {
    res.status(201).json({ quiz: await quizzesService.upsert(req.userId, req.body) });
  },

  async update(req: AuthedRequest, res: Response): Promise<void> {
    res.json({ quiz: await quizzesService.update(req.userId, req.params.id, req.body) });
  },

  async remove(req: AuthedRequest, res: Response): Promise<void> {
    await quizzesService.remove(req.userId, req.params.id);
    res.status(204).send();
  },
};
