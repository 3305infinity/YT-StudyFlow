import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { historyService } from '../services/history.service.js';

export const historyController = {
  async list(req: AuthedRequest, res: Response): Promise<void> {
    res.json({
      messages: await historyService.list(req.userId, req.query.videoId as string | undefined),
    });
  },

  async getById(req: AuthedRequest, res: Response): Promise<void> {
    res.json({ message: await historyService.getById(req.userId, req.params.id) });
  },

  async upsert(req: AuthedRequest, res: Response): Promise<void> {
    const messages = req.body.messages ?? [req.body];
    res.status(201).json({ messages: await historyService.upsertMany(req.userId, messages) });
  },

  async update(req: AuthedRequest, res: Response): Promise<void> {
    res.json({ message: await historyService.update(req.userId, req.params.id, req.body) });
  },

  async remove(req: AuthedRequest, res: Response): Promise<void> {
    await historyService.remove(req.userId, req.params.id);
    res.status(204).send();
  },

  async removeByVideo(req: AuthedRequest, res: Response): Promise<void> {
    const videoId = req.query.videoId as string;
    const count = await historyService.removeByVideo(req.userId, videoId);
    res.json({ deleted: count });
  },
};
