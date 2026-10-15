import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { corsOptions } from './config/cors.js';
import { clerkAuthMiddleware, requireAuth } from './middleware/auth.js';
import { globalRateLimiter, ipRateLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRoutes } from './routes/health.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { aiRoutes } from './routes/ai.routes.js';
import { ragRoutes } from './routes/rag.routes.js';
import { chatRoutes } from './routes/chat.routes.js';
import { notesRoutes } from './routes/notes.routes.js';
import { flashcardsRoutes } from './routes/flashcards.routes.js';
import { quizzesRoutes } from './routes/quizzes.routes.js';
import { historyRoutes } from './routes/history.routes.js';
import { playlistsRoutes } from './routes/playlists.routes.js';
import { studySessionsRoutes } from './routes/studySessions.routes.js';
import { transcriptRoutes } from './routes/transcript.routes.js';

import { personalNotesRouter } from './routes/personalNotes.routes.js';

/** requireAuth must run first so the per-user limiter can read req.userId. */
const apiGuards = [requireAuth, ipRateLimiter, globalRateLimiter];

export function createApp() {
  const app = express();

  // Render (and most PaaS hosts) terminate TLS in a proxy; trust exactly one hop so
  // req.ip is the real client address and not the proxy's.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '2mb' }));

  app.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'YT StudyFlow Backend',
    });
  });

  app.use('/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/personal-notes', personalNotesRouter);

  app.use(clerkAuthMiddleware);
  app.use('/api/ai', ...apiGuards, aiRoutes);
  app.use('/api/rag', ...apiGuards, ragRoutes);
  app.use('/api/chat', ...apiGuards, chatRoutes);
  app.use('/api/notes', ...apiGuards, notesRoutes);
  app.use('/api/flashcards', ...apiGuards, flashcardsRoutes);
  app.use('/api/quizzes', ...apiGuards, quizzesRoutes);
  app.use('/api/history', ...apiGuards, historyRoutes);
  app.use('/api/playlists', ...apiGuards, playlistsRoutes);
  app.use('/api/study-sessions', ...apiGuards, studySessionsRoutes);
  app.use('/api/transcript', ...apiGuards, transcriptRoutes);

  app.use(errorHandler);

  return app;
}
