import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { geminiService } from '../services/gemini.service.js';
import { ragService } from '../services/rag.service.js';
import { promptBuilderService } from '../services/promptBuilder.service.js';
import { citationService } from '../services/citation.service.js';
import { chatStructuredService } from '../services/chatStructured.service.js';
import { recordUsage } from '../middleware/rateLimit.js';
import { normalizeLanguageId } from '../lib/languages.js';

export const chatController = {
  async sendStructured(req: AuthedRequest, res: Response): Promise<void> {
    const {
      question,
      videoId,
      videoTitle,
      playlistId,
      mode = 'concise',
      language,
      chunks = [],
      topK = 14,
    } = req.body as {
      question: string;
      videoId: string;
      videoTitle?: string;
      playlistId?: string;
      mode?: 'concise' | 'deep' | 'interview';
      language?: string;
      chunks?: Parameters<typeof ragService.retrieve>[0]['chunks'];
      topK?: number;
    };

    const response = await chatStructuredService.send({
      userId: req.userId,
      question,
      videoId,
      videoTitle,
      playlistId,
      mode,
      language: normalizeLanguageId(language),
      chunks,
      topK,
    });

    await recordUsage(req, 'chat.structured');
    res.json(response);
  },

  async send(req: AuthedRequest, res: Response): Promise<void> {
    const {
      question,
      videoId,
      videoTitle,
      playlistId,
      mode = 'concise',
      language,
      chunks = [],
      topK = 14,
      system,
      user,
      maxOutputTokens,
      temperature,
    } = req.body as {
      question: string;
      videoId: string;
      videoTitle?: string;
      playlistId?: string;
      mode?: 'concise' | 'deep' | 'interview';
      language?: string;
      chunks?: Parameters<typeof ragService.retrieve>[0]['chunks'];
      topK?: number;
      system?: string;
      user?: string;
      maxOutputTokens?: number;
      temperature?: number;
    };

    let promptUser = user;
    let contextChunks = chunks;

    if (!promptUser) {
      const retrieved = await ragService.retrieve({
        userId: req.userId,
        videoId,
        question,
        chunks,
        topK,
        playlistId,
      });
      contextChunks = retrieved.map((r) => r.chunk);
      promptUser = promptBuilderService.buildChatUserPrompt({
        question,
        videoId,
        videoTitle,
        chunks: contextChunks,
      });
    }

    const result = await geminiService.generateText({
      model: 'gemini-2.5-flash-lite',
      prompt: {
        system:
          system ?? promptBuilderService.chatSystem(mode, normalizeLanguageId(language)),
        user: promptUser,
      },
      config: {
        temperature: temperature ?? 0.32,
        maxOutputTokens: maxOutputTokens ?? (mode === 'deep' ? 1200 : 900),
      },
    });

    await recordUsage(req, 'chat.send');
    res.json({
      content: result.content,
      model: result.model,
      tokensUsed: result.tokensUsed,
      relevantChunks: contextChunks,
      citations: citationService.buildCitations(
        contextChunks.map((chunk) => ({ chunk, score: 1 }))
      ),
    });
  },
};
