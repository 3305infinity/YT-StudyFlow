import { prisma } from '../database/prisma.js';

export const videoRepository = {
  async ensure(userId: string, youtubeId: string, meta?: { title?: string; channel?: string }) {
    if (!process.env.DATABASE_URL) {
      return { id: youtubeId, youtubeId, userId };
    }
    return prisma.video.upsert({
      where: { userId_youtubeId: { userId, youtubeId } },
      create: {
        userId,
        youtubeId,
        title: meta?.title,
        channel: meta?.channel,
      },
      update: {
        title: meta?.title,
        channel: meta?.channel,
      },
    });
  },

  async findByYoutubeId(userId: string, youtubeId: string) {
    if (!process.env.DATABASE_URL) return null;
    return prisma.video.findUnique({
      where: { userId_youtubeId: { userId, youtubeId } },
    });
  },

  async findById(userId: string, id: string) {
    if (!process.env.DATABASE_URL) return null;
    return prisma.video.findFirst({ where: { id, userId } });
  },

  async list(userId: string) {
    if (!process.env.DATABASE_URL) return [];
    return prisma.video.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async delete(userId: string, id: string) {
    if (!process.env.DATABASE_URL) return false;
    const existing = await prisma.video.findFirst({ where: { id, userId } });
    if (!existing) return false;
    await prisma.video.delete({ where: { id } });
    return true;
  },
};

export function toEpochMs(date: Date): number {
  return date.getTime();
}

export function fromEpochMs(ms: number): Date {
  return new Date(ms);
}
