import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { videoRepository } from './video.repository.js';

export const chatRepository = {
  async list(userId: string, youtubeVideoId?: string) {
    if (!process.env.DATABASE_URL) return [];
    let videoId: string | undefined;
    if (youtubeVideoId) {
      const video = await videoRepository.findByYoutubeId(userId, youtubeVideoId);
      videoId = video?.id;
      if (!videoId) return [];
    }
    return prisma.chat.findMany({
      where: { userId, ...(videoId ? { videoId } : {}) },
      orderBy: { createdAt: 'asc' },
      include: { video: { select: { youtubeId: true } } },
    });
  },

  async findById(userId: string, id: string) {
    if (!process.env.DATABASE_URL) return null;
    return prisma.chat.findFirst({
      where: { id, userId },
      include: { video: { select: { youtubeId: true } } },
    });
  },

  async upsertMany(
    userId: string,
    messages: Array<{
      id?: string;
      youtubeVideoId?: string;
      role: string;
      content: string;
      citations?: Prisma.InputJsonValue;
      mode?: string;
      model?: string;
      updatedAt?: number;
    }>
  ) {
    if (!process.env.DATABASE_URL) return [];
    const results = [];
    for (const msg of messages) {
      let videoId: string | null = null;
      if (msg.youtubeVideoId) {
        const video = await videoRepository.ensure(userId, msg.youtubeVideoId);
        videoId = video.id;
      }

      if (msg.id) {
        const existing = await prisma.chat.findFirst({ where: { id: msg.id, userId } });
        if (existing) {
          results.push(
            await prisma.chat.update({
              where: { id: msg.id },
              data: {
                content: msg.content,
                citations: msg.citations ?? undefined,
                mode: msg.mode,
                model: msg.model,
                ...(msg.updatedAt ? { updatedAt: new Date(msg.updatedAt) } : {}),
              },
              include: { video: { select: { youtubeId: true } } },
            })
          );
          continue;
        }
      }

      results.push(
        await prisma.chat.create({
          data: {
            userId,
            videoId,
            role: msg.role,
            content: msg.content,
            citations: msg.citations ?? undefined,
            mode: msg.mode,
            model: msg.model,
          },
          include: { video: { select: { youtubeId: true } } },
        })
      );
    }
    return results;
  },

  async update(
    userId: string,
    id: string,
    data: Partial<{
      content: string;
      citations: Prisma.InputJsonValue;
      mode: string;
      model: string;
      updatedAt: number;
    }>
  ) {
    if (!process.env.DATABASE_URL) return null;
    const existing = await prisma.chat.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const patch: Prisma.ChatUpdateInput = {};
    if (data.content !== undefined) patch.content = data.content;
    if (data.citations !== undefined) patch.citations = data.citations;
    if (data.mode !== undefined) patch.mode = data.mode;
    if (data.model !== undefined) patch.model = data.model;
    if (data.updatedAt !== undefined) patch.updatedAt = new Date(data.updatedAt);
    return prisma.chat.update({
      where: { id },
      data: patch,
      include: { video: { select: { youtubeId: true } } },
    });
  },

  async delete(userId: string, id: string) {
    if (!process.env.DATABASE_URL) return false;
    const existing = await prisma.chat.findFirst({ where: { id, userId } });
    if (!existing) return false;
    await prisma.chat.delete({ where: { id } });
    return true;
  },

  async deleteByVideo(userId: string, youtubeVideoId: string) {
    if (!process.env.DATABASE_URL) return 0;
    const video = await videoRepository.findByYoutubeId(userId, youtubeVideoId);
    if (!video) return 0;
    const result = await prisma.chat.deleteMany({ where: { userId, videoId: video.id } });
    return result.count;
  },
};

/** @deprecated Use chatRepository — kept for history module naming */
export const historyRepository = chatRepository;
