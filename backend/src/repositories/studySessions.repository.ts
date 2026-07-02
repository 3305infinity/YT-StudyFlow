import { prisma } from '../database/prisma.js';

export const studySessionsRepository = {
  async list(userId: string, playlistId?: string) {
    if (!process.env.DATABASE_URL) return [];
    return prisma.studySession.findMany({
      where: { userId, ...(playlistId ? { playlistId } : {}) },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async upsert(
    userId: string,
    data: {
      id?: string;
      playlistId?: string;
      topic: string;
      level?: string;
      payload: unknown;
      updatedAt?: number;
    }
  ) {
    if (data.id) {
      const existing = await prisma.studySession.findFirst({ where: { id: data.id, userId } });
      if (existing) {
        return prisma.studySession.update({
          where: { id: data.id },
          data: {
            playlistId: data.playlistId,
            topic: data.topic,
            level: data.level,
            payload: data.payload as object,
            ...(data.updatedAt ? { updatedAt: new Date(data.updatedAt) } : {}),
          },
        });
      }
    }

    return prisma.studySession.create({
      data: {
        userId,
        playlistId: data.playlistId,
        topic: data.topic,
        level: data.level,
        payload: data.payload as object,
      },
    });
  },

  async findById(userId: string, id: string) {
    if (!process.env.DATABASE_URL) return null;
    return prisma.studySession.findFirst({ where: { id, userId } });
  },

  async update(
    userId: string,
    id: string,
    data: Partial<{
      playlistId: string;
      topic: string;
      level: string;
      payload: unknown;
      updatedAt: number;
    }>
  ) {
    if (!process.env.DATABASE_URL) return null;
    const existing = await prisma.studySession.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return prisma.studySession.update({
      where: { id },
      data: {
        ...(data.playlistId !== undefined ? { playlistId: data.playlistId } : {}),
        ...(data.topic !== undefined ? { topic: data.topic } : {}),
        ...(data.level !== undefined ? { level: data.level } : {}),
        ...(data.payload !== undefined ? { payload: data.payload as object } : {}),
        ...(data.updatedAt !== undefined ? { updatedAt: new Date(data.updatedAt) } : {}),
      },
    });
  },

  async delete(userId: string, id: string) {
    if (!process.env.DATABASE_URL) return false;
    const existing = await prisma.studySession.findFirst({ where: { id, userId } });
    if (!existing) return false;
    await prisma.studySession.delete({ where: { id } });
    return true;
  },
};
