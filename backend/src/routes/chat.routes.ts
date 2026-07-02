import { Router } from 'express';
import { z } from 'zod';
import { chatController } from '../controllers/chat.controller.js';
import { validateBody } from '../middleware/validate.js';
import { enforceDailyQuota } from '../middleware/rateLimit.js';
import type { AuthedRequest } from '../middleware/auth.js';

const chunkSchema = z.object({
  id: z.string(),
  text: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  videoId: z.string(),
  videoTitle: z.string().optional(),
  playlistId: z.string().optional(),
});

const chatSchema = z.object({
  question: z.string().min(1).max(4000),
  videoId: z.string().min(1),
  videoTitle: z.string().optional(),
  playlistId: z.string().optional(),
  mode: z.enum(['concise', 'deep', 'interview']).optional(),
  language: z
    .enum(['en', 'hi', 'hinglish', 'es', 'fr', 'de', 'ja', 'zh', 'ko'])
    .optional(),
  chunks: z.array(chunkSchema).max(500).optional(),
  topK: z.number().int().min(1).max(50).optional(),
  system: z.string().max(20_000).optional(),
  user: z.string().max(120_000).optional(),
  maxOutputTokens: z.number().int().optional(),
  temperature: z.number().optional(),
});

export const chatRoutes = Router();

chatRoutes.post('/', enforceDailyQuota, validateBody(chatSchema), (req, res, next) => {
  chatController.send(req as AuthedRequest, res).catch(next);
});

chatRoutes.post('/structured', enforceDailyQuota, validateBody(chatSchema), (req, res, next) => {
  chatController.sendStructured(req as AuthedRequest, res).catch(next);
});
