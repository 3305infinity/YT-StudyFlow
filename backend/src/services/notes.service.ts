import { AppError } from '../utils/appError.js';
import { notesRepository } from '../repositories/notes.repository.js';
import { toEpochMs } from '../repositories/video.repository.js';

function requireDb(): void {
  if (!process.env.DATABASE_URL) {
    throw new AppError(503, 'Database is not configured.');
  }
}

type NoteWithVideo = {
  id: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  anchors: unknown;
  createdAt: Date;
  updatedAt: Date;
  video: { youtubeId: string; title: string | null };
};

function serializeNote(row: NoteWithVideo) {
  return {
    id: row.id,
    youtubeVideoId: row.video.youtubeId,
    type: row.type,
    title: row.title,
    content: row.content,
    tags: row.tags,
    anchors: row.anchors,
    createdAt: toEpochMs(row.createdAt),
    updatedAt: toEpochMs(row.updatedAt),
  };
}

export const notesService = {
  async list(userId: string, youtubeVideoId?: string) {
    requireDb();
    return (await notesRepository.list(userId, youtubeVideoId)).map(serializeNote);
  },

  async getById(userId: string, id: string) {
    requireDb();
    const row = await notesRepository.findById(userId, id);
    if (!row) throw new AppError(404, 'Note not found.');
    return serializeNote(row);
  },

  async create(
    userId: string,
    body: {
      youtubeVideoId: string;
      type: string;
      title: string;
      content: string;
      tags?: string[];
      anchors?: unknown;
      videoTitle?: string;
    }
  ) {
    requireDb();
    return serializeNote(
      await notesRepository.create(userId, {
        ...body,
        anchors: body.anchors as import('@prisma/client').Prisma.InputJsonValue | undefined,
      })
    );
  },

  async update(
    userId: string,
    id: string,
    body: Partial<{
      type: string;
      title: string;
      content: string;
      tags: string[];
      anchors: unknown;
    }>
  ) {
    requireDb();
    const row = await notesRepository.update(userId, id, body);
    if (!row) throw new AppError(404, 'Note not found.');
    return serializeNote(row);
  },

  async remove(userId: string, id: string) {
    requireDb();
    const ok = await notesRepository.delete(userId, id);
    if (!ok) throw new AppError(404, 'Note not found.');
  },
};
