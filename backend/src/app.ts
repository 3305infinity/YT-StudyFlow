import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { corsOptions } from './config/cors.js';
import { clerkAuthMiddleware, requireAuth } from './middleware/auth.js';
import { globalRateLimiter } from './middleware/rateLimit.js';
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

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '2mb' }));

  app.use('/health', healthRoutes);

  app.use(clerkAuthMiddleware);
  app.use('/api/auth', requireAuth, authRoutes);
  app.use('/api/ai', requireAuth, globalRateLimiter, aiRoutes);
  app.use('/api/rag', requireAuth, globalRateLimiter, ragRoutes);
  app.use('/api/chat', requireAuth, globalRateLimiter, chatRoutes);
  app.use('/api/notes', requireAuth, globalRateLimiter, notesRoutes);
  app.use('/api/flashcards', requireAuth, globalRateLimiter, flashcardsRoutes);
  app.use('/api/quizzes', requireAuth, globalRateLimiter, quizzesRoutes);
  app.use('/api/history', requireAuth, globalRateLimiter, historyRoutes);
  app.use('/api/playlists', requireAuth, globalRateLimiter, playlistsRoutes);
  app.use('/api/study-sessions', requireAuth, globalRateLimiter, studySessionsRoutes);
  app.use('/api/transcript', requireAuth, globalRateLimiter, transcriptRoutes);

  app.use(errorHandler);

  return app;
}
