import { Router } from 'express';
import { z } from 'zod';
import { ragController } from '../controllers/rag.controller.js';
import { validateBody } from '../middleware/validate.js';
import { enforceDailyQuota } from '../middleware/rateLimit.js';
import type { AuthedRequest } from '../middleware/auth.js';

const chunkSchema = z.object({
  id: z.string(),
  text: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  transcriptChunkIds: z.array(z.string()).optional(),
  videoId: z.string(),
  videoTitle: z.string().optional(),
  playlistId: z.string().optional(),
});

const indexSchema = z.object({
  videoId: z.string().min(1),
  chunks: z.array(chunkSchema).min(1).max(200),
});

const retrieveSchema = z.object({
  videoId: z.string().min(1),
  question: z.string().min(1).max(4000),
  chunks: z.array(chunkSchema).max(500),
  topK: z.number().int().min(1).max(50).default(14),
});

const embedSchema = z.object({
  chunks: z.array(chunkSchema).min(1).max(64),
});

export const ragRoutes = Router();

ragRoutes.post('/index', enforceDailyQuota, validateBody(indexSchema), (req, res, next) => {
  ragController.index(req as AuthedRequest, res).catch(next);
});

ragRoutes.post('/retrieve', enforceDailyQuota, validateBody(retrieveSchema), (req, res, next) => {
  ragController.retrieve(req as AuthedRequest, res).catch(next);
});

ragRoutes.post('/embed', enforceDailyQuota, validateBody(embedSchema), (req, res, next) => {
  ragController.embed(req as AuthedRequest, res).catch(next);
});
