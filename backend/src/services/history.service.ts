import { AppError } from '../utils/appError.js';
import { chatRepository } from '../repositories/chat.repository.js';
import { toEpochMs } from '../repositories/video.repository.js';

function requireDb(): void {
  if (!process.env.DATABASE_URL) throw new AppError(503, 'Database is not configured.');
}

type ChatRow = Awaited<ReturnType<typeof chatRepository.list>>[number];

function serialize(row: ChatRow) {
  return {
    id: row.id,
    youtubeVideoId: row.video?.youtubeId ?? null,
    role: row.role,
    content: row.content,
    citations: row.citations,
    mode: row.mode,
    model: row.model,
    createdAt: toEpochMs(row.createdAt),
    updatedAt: toEpochMs(row.updatedAt),
  };
}

export const historyService = {
  async list(userId: string, youtubeVideoId?: string) {
    requireDb();
    return (await chatRepository.list(userId, youtubeVideoId)).map(serialize);
  },

  async getById(userId: string, id: string) {
    requireDb();
    const row = await chatRepository.findById(userId, id);
    if (!row) throw new AppError(404, 'Message not found.');
    return serialize(row);
  },

  async upsertMany(userId: string, messages: Parameters<typeof chatRepository.upsertMany>[1]) {
    requireDb();
    return (await chatRepository.upsertMany(userId, messages)).map(serialize);
  },

  async update(
    userId: string,
    id: string,
    body: Partial<{
      content: string;
      citations: unknown;
      mode: string;
      model: string;
      updatedAt: number;
    }>
  ) {
    requireDb();
    const row = await chatRepository.update(userId, id, {
      ...body,
      citations: body.citations as import('@prisma/client').Prisma.InputJsonValue | undefined,
    });
    if (!row) throw new AppError(404, 'Message not found.');
    return serialize(row);
  },

  async remove(userId: string, id: string) {
    requireDb();
    const ok = await chatRepository.delete(userId, id);
    if (!ok) throw new AppError(404, 'Message not found.');
  },

  async removeByVideo(userId: string, youtubeVideoId: string) {
    requireDb();
    return chatRepository.deleteByVideo(userId, youtubeVideoId);
  },
};
