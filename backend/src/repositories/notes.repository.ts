import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { videoRepository } from './video.repository.js';

export const notesRepository = {
  async list(userId: string, youtubeVideoId?: string) {
    if (!process.env.DATABASE_URL) return [];
    const video = youtubeVideoId
      ? await videoRepository.findByYoutubeId(userId, youtubeVideoId)
      : null;
    return prisma.note.findMany({
      where: {
        userId,
        ...(video ? { videoId: video.id } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: { video: { select: { youtubeId: true, title: true } } },
    });
  },

  async findById(userId: string, id: string) {
    if (!process.env.DATABASE_URL) return null;
    return prisma.note.findFirst({
      where: { id, userId },
      include: { video: { select: { youtubeId: true, title: true } } },
    });
  },

  async create(
    userId: string,
    data: {
      youtubeVideoId: string;
      type: string;
      title: string;
      content: string;
      tags?: string[];
      anchors?: Prisma.InputJsonValue;
      videoTitle?: string;
    }
  ) {
    const video = await videoRepository.ensure(userId, data.youtubeVideoId, {
      title: data.videoTitle,
    });
    return prisma.note.create({
      data: {
        userId,
        videoId: video.id,
        type: data.type,
        title: data.title,
        content: data.content,
        tags: data.tags ?? [],
        anchors: data.anchors ?? undefined,
      },
      include: { video: { select: { youtubeId: true, title: true } } },
    });
  },

  async update(
    userId: string,
    id: string,
    data: Partial<{
      type: string;
      title: string;
      content: string;
      tags: string[];
      anchors: unknown;
    }>
  ) {
    const existing = await prisma.note.findFirst({ where: { id, userId } });
    if (!existing) return null;
    const patch: Prisma.NoteUpdateInput = {};
    if (data.type !== undefined) patch.type = data.type;
    if (data.title !== undefined) patch.title = data.title;
    if (data.content !== undefined) patch.content = data.content;
    if (data.tags !== undefined) patch.tags = data.tags;
    if (data.anchors !== undefined) {
      patch.anchors = data.anchors as Prisma.InputJsonValue;
    }
    return prisma.note.update({
      where: { id },
      data: patch,
      include: { video: { select: { youtubeId: true, title: true } } },
    });
  },

  async delete(userId: string, id: string) {
    const existing = await prisma.note.findFirst({ where: { id, userId } });
    if (!existing) return false;
    await prisma.note.delete({ where: { id } });
    return true;
  },
};
