import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { geminiService } from '../services/gemini.service.js';
import { recordUsage } from '../middleware/rateLimit.js';
import { env } from '../config/env.js';
import { GEMINI_DEFAULTS, GEMINI_API_BASE } from '../services/gemini/gemini.config.js';

export const aiController = {
  async generate(req: AuthedRequest, res: Response): Promise<void> {
    const result = await geminiService.generateText(req.body);
    await recordUsage(req, 'ai.generate');
    res.json(result);
  },

  async embed(req: AuthedRequest, res: Response): Promise<void> {
    const result = await geminiService.embedTexts(req.body);
    await recordUsage(req, 'ai.embed');
    res.json(result);
  },

  async health(_req: AuthedRequest, res: Response): Promise<void> {
    res.json({
      ok: true,
      service: 'ai',
      configured: !!env.geminiApiKey,
      endpoint: GEMINI_API_BASE,
      defaultTextModel: GEMINI_DEFAULTS.textModel,
      defaultEmbeddingModel: GEMINI_DEFAULTS.embeddingModel,
    });
  },
};
