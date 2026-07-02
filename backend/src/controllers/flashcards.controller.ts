import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { flashcardsService } from '../services/flashcards.service.js';

export const flashcardsController = {
  async list(req: AuthedRequest, res: Response): Promise<void> {
    res.json({
      flashcards: await flashcardsService.list(req.userId, {
        youtubeVideoId: req.query.videoId as string | undefined,
        playlistId: req.query.playlistId as string | undefined,
      }),
    });
  },

  async getById(req: AuthedRequest, res: Response): Promise<void> {
    res.json({ flashcard: await flashcardsService.getById(req.userId, req.params.id) });
  },

  async upsert(req: AuthedRequest, res: Response): Promise<void> {
    const cards = req.body.cards ?? [req.body];
    res.status(201).json({ flashcards: await flashcardsService.upsertMany(req.userId, cards) });
  },

  async update(req: AuthedRequest, res: Response): Promise<void> {
    res.json({ flashcard: await flashcardsService.update(req.userId, req.params.id, req.body) });
  },

  async remove(req: AuthedRequest, res: Response): Promise<void> {
    await flashcardsService.remove(req.userId, req.params.id);
    res.status(204).send();
  },
};
