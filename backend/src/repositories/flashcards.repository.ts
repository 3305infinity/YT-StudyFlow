import { prisma } from '../database/prisma.js';
import { videoRepository } from './video.repository.js';

export const flashcardsRepository = {
  async list(userId: string, filters?: { youtubeVideoId?: string; playlistId?: string }) {
    if (!process.env.DATABASE_URL) return [];
    let videoId: string | undefined;
    if (filters?.youtubeVideoId) {
      const video = await videoRepository.findByYoutubeId(userId, filters.youtubeVideoId);
      videoId = video?.id;
      if (!videoId) return [];
    }
    return prisma.flashcard.findMany({
      where: {
        userId,
        ...(videoId ? { videoId } : {}),
        ...(filters?.playlistId
          ? { tags: { has: `playlist:${filters.playlistId}` } }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: { video: { select: { youtubeId: true } } },
    });
  },

  async upsertMany(
    userId: string,
    cards: Array<{
      id?: string;
      youtubeVideoId: string;
      front: string;
      back: string;
      tags?: string[];
      sm2?: unknown;
      nextReviewAt?: string | null;
      playlistId?: string;
      updatedAt?: number;
    }>
  ) {
    const results = [];
    for (const card of cards) {
      const video = await videoRepository.ensure(userId, card.youtubeVideoId);
      const tags = [...(card.tags ?? [])];
      if (card.playlistId && !tags.includes(`playlist:${card.playlistId}`)) {
        tags.push(`playlist:${card.playlistId}`);
      }
      const sm2Payload = card.sm2 ?? undefined;
      const nextReviewAt = card.nextReviewAt ? new Date(card.nextReviewAt) : null;

      if (card.id) {
        const existing = await prisma.flashcard.findFirst({ where: { id: card.id, userId } });
        if (existing) {
          results.push(
            await prisma.flashcard.update({
              where: { id: card.id },
              data: {
                front: card.front,
                back: card.back,
                tags,
                sm2: sm2Payload,
                nextReviewAt,
                ...(card.updatedAt ? { updatedAt: new Date(card.updatedAt) } : {}),
              },
              include: { video: { select: { youtubeId: true } } },
            })
          );
          continue;
        }
      }

      results.push(
        await prisma.flashcard.create({
          data: {
            userId,
            videoId: video.id,
            front: card.front,
            back: card.back,
            tags,
            sm2: sm2Payload,
            nextReviewAt,
          },
          include: { video: { select: { youtubeId: true } } },
        })
      );
    }
    return results;
  },

  async findById(userId: string, id: string) {
    if (!process.env.DATABASE_URL) return null;
    return prisma.flashcard.findFirst({
      where: { id, userId },
      include: { video: { select: { youtubeId: true } } },
    });
  },

  async update(
    userId: string,
    id: string,
    data: Partial<{
      front: string;
      back: string;
      tags: string[];
      sm2: unknown;
      nextReviewAt: string | null;
      updatedAt: number;
    }>
  ) {
    if (!process.env.DATABASE_URL) return null;
    const existing = await prisma.flashcard.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return prisma.flashcard.update({
      where: { id },
      data: {
        ...(data.front !== undefined ? { front: data.front } : {}),
        ...(data.back !== undefined ? { back: data.back } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.sm2 !== undefined ? { sm2: data.sm2 as object } : {}),
        ...(data.nextReviewAt !== undefined
          ? { nextReviewAt: data.nextReviewAt ? new Date(data.nextReviewAt) : null }
          : {}),
        ...(data.updatedAt !== undefined ? { updatedAt: new Date(data.updatedAt) } : {}),
      },
      include: { video: { select: { youtubeId: true } } },
    });
  },

  async delete(userId: string, id: string) {
    if (!process.env.DATABASE_URL) return false;
    const existing = await prisma.flashcard.findFirst({ where: { id, userId } });
    if (!existing) return false;
    await prisma.flashcard.delete({ where: { id } });
    return true;
  },
};
