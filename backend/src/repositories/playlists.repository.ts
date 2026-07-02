import { prisma } from '../database/prisma.js';

export const playlistsRepository = {
  async list(userId: string) {
    if (!process.env.DATABASE_URL) return [];
    return prisma.playlist.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async upsert(
    userId: string,
    data: {
      id?: string;
      youtubeId: string;
      title?: string;
      videoIds?: string[];
      updatedAt?: number;
    }
  ) {
    if (data.id) {
      const existing = await prisma.playlist.findFirst({ where: { id: data.id, userId } });
      if (existing) {
        return prisma.playlist.update({
          where: { id: data.id },
          data: {
            title: data.title,
            videoIds: data.videoIds ?? existing.videoIds,
            ...(data.updatedAt ? { updatedAt: new Date(data.updatedAt) } : {}),
          },
        });
      }
    }

    return prisma.playlist.upsert({
      where: { userId_youtubeId: { userId, youtubeId: data.youtubeId } },
      create: {
        userId,
        youtubeId: data.youtubeId,
        title: data.title,
        videoIds: data.videoIds ?? [],
      },
      update: {
        title: data.title,
        videoIds: data.videoIds,
        ...(data.updatedAt ? { updatedAt: new Date(data.updatedAt) } : {}),
      },
    });
  },

  async findById(userId: string, id: string) {
    if (!process.env.DATABASE_URL) return null;
    return prisma.playlist.findFirst({ where: { id, userId } });
  },

  async update(
    userId: string,
    id: string,
    data: Partial<{
      title: string;
      videoIds: string[];
      updatedAt: number;
    }>
  ) {
    if (!process.env.DATABASE_URL) return null;
    const existing = await prisma.playlist.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return prisma.playlist.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.videoIds !== undefined ? { videoIds: data.videoIds } : {}),
        ...(data.updatedAt !== undefined ? { updatedAt: new Date(data.updatedAt) } : {}),
      },
    });
  },

  async delete(userId: string, id: string) {
    if (!process.env.DATABASE_URL) return false;
    const existing = await prisma.playlist.findFirst({ where: { id, userId } });
    if (!existing) return false;
    await prisma.playlist.delete({ where: { id } });
    return true;
  },
};
