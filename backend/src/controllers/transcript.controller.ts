import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { transcriptTranslationService } from '../services/transcriptTranslation.service.js';
import { normalizeLanguageId } from '../lib/languages.js';
import { recordUsage } from '../middleware/rateLimit.js';

export const transcriptController = {
  async translate(req: AuthedRequest, res: Response): Promise<void> {
    const { videoId, targetLanguage, sourceLanguage, chunks = [] } = req.body as {
      videoId: string;
      targetLanguage?: string;
      sourceLanguage?: string;
      chunks: Array<{
        id: string;
        text: string;
        startTime: number;
        endTime: number;
        duration: number;
        index: number;
      }>;
    };

    const result = await transcriptTranslationService.translate({
      videoId,
      targetLanguage: normalizeLanguageId(targetLanguage),
      sourceLanguage,
      chunks,
    });

    await recordUsage(req, 'transcript.translate');
    res.json(result);
  },
};
