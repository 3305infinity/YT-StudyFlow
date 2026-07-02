import { AppError } from '../utils/appError.js';
import { quizzesRepository } from '../repositories/quizzes.repository.js';
import { toEpochMs } from '../repositories/video.repository.js';

function requireDb(): void {
  if (!process.env.DATABASE_URL) throw new AppError(503, 'Database is not configured.');
}

function serialize(row: Awaited<ReturnType<typeof quizzesRepository.list>>[number]) {
  return {
    id: row.id,
    youtubeVideoId: row.video.youtubeId,
    mode: row.mode,
    questions: row.questions,
    createdAt: toEpochMs(row.createdAt),
    updatedAt: toEpochMs(row.updatedAt),
  };
}

export const quizzesService = {
  async list(userId: string, youtubeVideoId?: string) {
    requireDb();
    return (await quizzesRepository.list(userId, youtubeVideoId)).map(serialize);
  },

  async getById(userId: string, id: string) {
    requireDb();
    const row = await quizzesRepository.findById(userId, id);
    if (!row) throw new AppError(404, 'Quiz not found.');
    return serialize(row);
  },

  async upsert(userId: string, body: Parameters<typeof quizzesRepository.upsert>[1]) {
    requireDb();
    return serialize(await quizzesRepository.upsert(userId, body));
  },

  async update(userId: string, id: string, body: Parameters<typeof quizzesRepository.update>[2]) {
    requireDb();
    const row = await quizzesRepository.update(userId, id, body);
    if (!row) throw new AppError(404, 'Quiz not found.');
    return serialize(row);
  },

  async remove(userId: string, id: string) {
    requireDb();
    const ok = await quizzesRepository.delete(userId, id);
    if (!ok) throw new AppError(404, 'Quiz not found.');
  },
};
