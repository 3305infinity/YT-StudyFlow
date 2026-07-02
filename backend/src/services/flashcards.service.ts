import { AppError } from '../utils/appError.js';
import { flashcardsRepository } from '../repositories/flashcards.repository.js';
import { toEpochMs } from '../repositories/video.repository.js';

function requireDb(): void {
  if (!process.env.DATABASE_URL) throw new AppError(503, 'Database is not configured.');
}

function serialize(row: Awaited<ReturnType<typeof flashcardsRepository.list>>[number]) {
  const playlistTag = row.tags.find((t) => t.startsWith('playlist:'));
  return {
    id: row.id,
    youtubeVideoId: row.video.youtubeId,
    front: row.front,
    back: row.back,
    tags: row.tags,
    sm2: row.sm2,
    nextReviewAt: row.nextReviewAt ? row.nextReviewAt.toISOString() : null,
    playlistId: playlistTag?.slice('playlist:'.length),
    createdAt: toEpochMs(row.createdAt),
    updatedAt: toEpochMs(row.updatedAt),
  };
}

export const flashcardsService = {
  async list(userId: string, filters?: { youtubeVideoId?: string; playlistId?: string }) {
    requireDb();
    return (await flashcardsRepository.list(userId, filters)).map(serialize);
  },

  async getById(userId: string, id: string) {
    requireDb();
    const row = await flashcardsRepository.findById(userId, id);
    if (!row) throw new AppError(404, 'Flashcard not found.');
    return serialize(row);
  },

  async upsertMany(userId: string, cards: Parameters<typeof flashcardsRepository.upsertMany>[1]) {
    requireDb();
    return (await flashcardsRepository.upsertMany(userId, cards)).map(serialize);
  },

  async update(
    userId: string,
    id: string,
    body: Parameters<typeof flashcardsRepository.update>[2]
  ) {
    requireDb();
    const row = await flashcardsRepository.update(userId, id, body);
    if (!row) throw new AppError(404, 'Flashcard not found.');
    return serialize(row);
  },

  async remove(userId: string, id: string) {
    requireDb();
    const ok = await flashcardsRepository.delete(userId, id);
    if (!ok) throw new AppError(404, 'Flashcard not found.');
  },
};
