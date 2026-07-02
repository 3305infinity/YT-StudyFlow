import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { ragService } from '../services/rag.service.js';
import { recordUsage } from '../middleware/rateLimit.js';

export const ragController = {
  async index(req: AuthedRequest, res: Response): Promise<void> {
    const { videoId, chunks } = req.body as {
      videoId: string;
      chunks: Parameters<typeof ragService.indexVideo>[0]['chunks'];
    };
    const indexed = await ragService.indexVideo({
      userId: req.userId,
      videoId,
      chunks,
    });
    await recordUsage(req, 'rag.index');
    res.json({ chunks: indexed });
  },

  async retrieve(req: AuthedRequest, res: Response): Promise<void> {
    const { videoId, question, chunks, topK, playlistId } = req.body as {
      videoId: string;
      question: string;
      chunks: Parameters<typeof ragService.retrieve>[0]['chunks'];
      topK: number;
      playlistId?: string;
    };
    const results = await ragService.retrieve({
      userId: req.userId,
      videoId,
      question,
      chunks,
      topK,
      playlistId,
    });
    await recordUsage(req, 'rag.retrieve');
    res.json({ results });
  },

  async embed(req: AuthedRequest, res: Response): Promise<void> {
    const { chunks } = req.body as {
      chunks: Parameters<typeof ragService.embedChunks>[0];
    };
    const embedded = await ragService.embedChunks(chunks);
    await recordUsage(req, 'rag.embed');
    res.json({ chunks: embedded });
  },
};
