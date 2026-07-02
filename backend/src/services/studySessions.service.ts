import { AppError } from '../utils/appError.js';
import { studySessionsRepository } from '../repositories/studySessions.repository.js';
import { toEpochMs } from '../repositories/video.repository.js';

function requireDb(): void {
  if (!process.env.DATABASE_URL) throw new AppError(503, 'Database is not configured.');
}

function serialize(row: Awaited<ReturnType<typeof studySessionsRepository.list>>[number]) {
  return {
    id: row.id,
    playlistId: row.playlistId,
    topic: row.topic,
    level: row.level,
    payload: row.payload,
    createdAt: toEpochMs(row.createdAt),
    updatedAt: toEpochMs(row.updatedAt),
  };
}

export const studySessionsService = {
  async list(userId: string, playlistId?: string) {
    requireDb();
    return (await studySessionsRepository.list(userId, playlistId)).map(serialize);
  },

  async getById(userId: string, id: string) {
    requireDb();
    const row = await studySessionsRepository.findById(userId, id);
    if (!row) throw new AppError(404, 'Study session not found.');
    return serialize(row);
  },

  async upsert(userId: string, body: Parameters<typeof studySessionsRepository.upsert>[1]) {
    requireDb();
    return serialize(await studySessionsRepository.upsert(userId, body));
  },

  async update(
    userId: string,
    id: string,
    body: Parameters<typeof studySessionsRepository.update>[2]
  ) {
    requireDb();
    const row = await studySessionsRepository.update(userId, id, body);
    if (!row) throw new AppError(404, 'Study session not found.');
    return serialize(row);
  },

  async remove(userId: string, id: string) {
    requireDb();
    const ok = await studySessionsRepository.delete(userId, id);
    if (!ok) throw new AppError(404, 'Study session not found.');
  },
};
