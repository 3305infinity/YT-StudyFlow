import { AppError } from '../utils/appError.js';
import { playlistsRepository } from '../repositories/playlists.repository.js';
import { toEpochMs } from '../repositories/video.repository.js';

function requireDb(): void {
  if (!process.env.DATABASE_URL) throw new AppError(503, 'Database is not configured.');
}

function serialize(row: Awaited<ReturnType<typeof playlistsRepository.list>>[number]) {
  return {
    id: row.id,
    youtubeId: row.youtubeId,
    title: row.title,
    videoIds: row.videoIds,
    createdAt: toEpochMs(row.createdAt),
    updatedAt: toEpochMs(row.updatedAt),
  };
}

export const playlistsService = {
  async list(userId: string) {
    requireDb();
    return (await playlistsRepository.list(userId)).map(serialize);
  },

  async getById(userId: string, id: string) {
    requireDb();
    const row = await playlistsRepository.findById(userId, id);
    if (!row) throw new AppError(404, 'Playlist not found.');
    return serialize(row);
  },

  async upsert(userId: string, body: Parameters<typeof playlistsRepository.upsert>[1]) {
    requireDb();
    return serialize(await playlistsRepository.upsert(userId, body));
  },

  async update(userId: string, id: string, body: Parameters<typeof playlistsRepository.update>[2]) {
    requireDb();
    const row = await playlistsRepository.update(userId, id, body);
    if (!row) throw new AppError(404, 'Playlist not found.');
    return serialize(row);
  },

  async remove(userId: string, id: string) {
    requireDb();
    const ok = await playlistsRepository.delete(userId, id);
    if (!ok) throw new AppError(404, 'Playlist not found.');
  },
};
