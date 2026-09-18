import { VECTOR_SEARCH } from '@lib/constants';
import { DbIds, ensureDbReady, getDb, nowMs } from '@lib/db';
import type { Note, NoteType } from '@/types/notes';
import type { SemanticChunk } from '@/types/ai';
import { canUseGeminiApi, getSettings } from '@lib/storage';
import { localNotes } from '@/features/ai/localGeneration';
import { retrieveRelevantChunks } from '@/features/ai/ragPipeline.service';
import { scheduleSync, syncVideoScope } from '@/lib/sync/engine';
import { getCurrentVideoId } from '@lib/youtube';
import { api } from '@/lib/api/client';

export async function generateNote(params: {
  videoId: string;
  type: NoteType;
  semanticChunks: SemanticChunk[];
  videoTitle?: string;
  includeTimestamps?: boolean;
  topicQuery?: string;
}): Promise<Note> {
  const includeTimestamps = params.includeTimestamps ?? true;
  const capturedVideoId = params.videoId;
  const stale = () => getCurrentVideoId() !== capturedVideoId;

  if (stale()) throw new Error('Video changed before note generation');

  const query = params.topicQuery
    ? `${params.topicQuery} ${params.type} study notes`
    : `${params.type} study notes key concepts walkthrough ${params.videoTitle ?? ''}`;
  const relevant = await retrieveRelevantChunks(
    query,
    params.semanticChunks,
    VECTOR_SEARCH.CHAT_TOP_K,
    0,
    []
  );
  if (stale()) throw new Error('Video changed during note generation');

  const contextChunks = relevant.length ? relevant : params.semanticChunks;
  let title = `${params.type} notes`;
  let content = contextChunks.map((c) => `- ${c.text}`).join('\n');
  let tags: string[] = [params.type];

  if (!(await canUseGeminiApi())) {
    const local = localNotes(params.type, contextChunks, params.videoTitle);
    title = local.title;
    content = local.content;
  } else {
  try {
    const settings = await getSettings();
    if (stale()) throw new Error('Video changed during note generation');
    
    const structuredResp = await api.post<{
      directAnswer?: string;
      lectureContent?: string;
      summary?: string;
      explanation?: string;
      keyTakeaways?: string[];
    }>('/api/chat/structured', {
      question: `Generate comprehensive ${params.type} study notes for ${params.videoTitle ?? 'this lecture'}`,
      videoId: params.videoId,
      videoTitle: params.videoTitle,
      mode: 'concise',
      language: settings.responseLanguage,
      chunks: contextChunks.map((c) => ({
        id: c.id,
        text: c.text,
        startTime: c.startTime,
        endTime: c.endTime,
        videoId: c.videoId ?? '',
      })),
    });

    if (stale()) throw new Error('Video changed during note generation');

    title = `${params.type.toUpperCase()} - ${params.videoTitle ?? 'Lecture Notes'}`;
    content = structuredResp.explanation || structuredResp.lectureContent || structuredResp.directAnswer || structuredResp.summary || content;
    tags = [params.type, 'groq-tutor'];
  } catch (e) {
    console.warn('[YT StudyFlow] Groq notes generation failed — using local fallback', e);
    if (stale()) throw new Error('Video changed during note generation');
    const local = localNotes(params.type, contextChunks, params.videoTitle);
    title = local.title;
    content = local.content;
  }
  }

  if (stale()) throw new Error('Video changed before persisting note');

  const ts = nowMs();
  const id = DbIds.note(capturedVideoId, `note_${params.type}_${ts}`);

  const note: Note = {
    id,
    videoId: capturedVideoId,
    type: params.type,
    title,
    content,
    format: 'markdown',
    tags,
    isPinned: false,
    createdAt: ts,
    updatedAt: ts,
    timestampAnchors: includeTimestamps
      ? contextChunks.slice(0, 15).map((c) => ({ startTime: c.startTime, endTime: c.endTime }))
      : undefined,
  };

  await ensureDbReady();
  if (stale()) throw new Error('Video changed before persisting note');
  await getDb().notes.put({
    ...note,
    schemaVersion: 3,
    dirty: true,
  });

  scheduleSync();
  return note;
}

export async function listNotes(videoId: string): Promise<Note[]> {
  const capturedVideoId = videoId;
  await ensureDbReady();
  try {
    await syncVideoScope(videoId);
  } catch {
    // offline — serve Dexie cache
  }
  const rows = await getDb().notes.where('videoId').equals(capturedVideoId).toArray();
  return rows
    .filter((r) => !r.deleted)
    .map((r) => ({
    id: r.id,
    videoId: r.videoId,
    type: r.type,
    title: r.title,
    content: r.content,
    format: r.format,
    tags: r.tags,
    isPinned: r.isPinned,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    timestampAnchors: r.timestampAnchors,
  }));
}

export async function deleteNote(id: string): Promise<void> {
  await ensureDbReady();
  const row = await getDb().notes.get(id);
  if (!row) return;
  if (row.remoteId) {
    await getDb().notes.put({ ...row, deleted: true, dirty: true, updatedAt: nowMs() });
  } else {
    await getDb().notes.delete(id);
  }
  scheduleSync();
}

export async function updateNoteContent(id: string, content: string, title?: string): Promise<Note | null> {
  await ensureDbReady();
  const row = await getDb().notes.get(id);
  if (!row || row.deleted) return null;

  const updated: Note = {
    id: row.id,
    videoId: row.videoId,
    type: row.type,
    title: title ?? row.title,
    content,
    format: row.format,
    tags: row.tags,
    isPinned: row.isPinned,
    createdAt: row.createdAt,
    updatedAt: nowMs(),
    timestampAnchors: row.timestampAnchors,
  };

  await getDb().notes.put({
    ...updated,
    schemaVersion: row.schemaVersion,
    dirty: true,
    remoteId: row.remoteId,
    deleted: row.deleted,
  });

  scheduleSync();
  return updated;
}
