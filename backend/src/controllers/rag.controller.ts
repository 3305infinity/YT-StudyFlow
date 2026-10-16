import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { ragService } from '../services/rag.service.js';
import { pineconeService } from '../services/pinecone.service.js';
import { recordUsage } from '../middleware/rateLimit.js';
import { AppError } from '../utils/appError.js';

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

  /**
   * Deletes every stored vector for one video belonging to the calling installation.
   *
   * The namespace is derived from req.userId, so a caller can only ever delete their
   * own data — an install id cannot name someone else's namespace.
   */
  async deleteVideo(req: AuthedRequest, res: Response): Promise<void> {
    const videoId = String(req.params.videoId ?? '').trim();
    if (!videoId) {
      res.status(400).json({ error: 'BadRequest', message: 'videoId is required.' });
      return;
    }

    if (!pineconeService.isEnabled()) {
      // Nothing is stored server-side when Pinecone is not configured.
      res.json({ deleted: false, videoId, reason: 'VectorStoreDisabled' });
      return;
    }

    try {
      await pineconeService.deleteVideo(req.userId, videoId);
    } catch (err) {
      // Deleting a namespace that was never created returns 404. The caller's data is
      // absent either way, so report success and keep the operation idempotent.
      const message = err instanceof Error ? err.message : String(err);
      if (/404|not found/i.test(message)) {
        res.json({ deleted: true, videoId, note: 'NothingStored' });
        return;
      }
      throw new AppError(
        502,
        'Could not delete your stored data right now. Please try again.',
        undefined,
        'VectorDeleteFailed'
      );
    }

    res.json({ deleted: true, videoId });
  },
};
