import { prisma } from '../database/prisma.js';
import { videoRepository } from './video.repository.js';

export const quizzesRepository = {
  async list(userId: string, youtubeVideoId?: string) {
    if (!process.env.DATABASE_URL) return [];
    let videoId: string | undefined;
    if (youtubeVideoId) {
      const video = await videoRepository.findByYoutubeId(userId, youtubeVideoId);
      videoId = video?.id;
      if (!videoId) return [];
    }
    return prisma.quiz.findMany({
      where: { userId, ...(videoId ? { videoId } : {}) },
      orderBy: { updatedAt: 'desc' },
      include: { video: { select: { youtubeId: true } } },
    });
  },

  async upsert(
    userId: string,
    data: {
      id?: string;
      youtubeVideoId: string;
      mode: string;
      questions: unknown;
      videoTitle?: string;
      updatedAt?: number;
    }
  ) {
    const video = await videoRepository.ensure(userId, data.youtubeVideoId, {
      title: data.videoTitle,
    });

    if (data.id) {
      const existing = await prisma.quiz.findFirst({ where: { id: data.id, userId } });
      if (existing) {
        return prisma.quiz.update({
          where: { id: data.id },
          data: {
            mode: data.mode,
            questions: data.questions as object,
            ...(data.updatedAt ? { updatedAt: new Date(data.updatedAt) } : {}),
          },
          include: { video: { select: { youtubeId: true } } },
        });
      }
    }

    return prisma.quiz.create({
      data: {
        userId,
        videoId: video.id,
        mode: data.mode,
        questions: data.questions as object,
      },
      include: { video: { select: { youtubeId: true } } },
    });
  },

  async findById(userId: string, id: string) {
    if (!process.env.DATABASE_URL) return null;
    return prisma.quiz.findFirst({
      where: { id, userId },
      include: { video: { select: { youtubeId: true } } },
    });
  },

  async update(
    userId: string,
    id: string,
    data: Partial<{
      mode: string;
      questions: unknown;
      updatedAt: number;
    }>
  ) {
    if (!process.env.DATABASE_URL) return null;
    const existing = await prisma.quiz.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return prisma.quiz.update({
      where: { id },
      data: {
        ...(data.mode !== undefined ? { mode: data.mode } : {}),
        ...(data.questions !== undefined ? { questions: data.questions as object } : {}),
        ...(data.updatedAt !== undefined ? { updatedAt: new Date(data.updatedAt) } : {}),
      },
      include: { video: { select: { youtubeId: true } } },
    });
  },

  async delete(userId: string, id: string) {
    if (!process.env.DATABASE_URL) return false;
    const existing = await prisma.quiz.findFirst({ where: { id, userId } });
    if (!existing) return false;
    await prisma.quiz.delete({ where: { id } });
    return true;
  },
};
