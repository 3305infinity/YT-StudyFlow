import { DbIds, ensureDbReady, getDb, nowMs, type NoteRow } from '@lib/db';
import { api } from '@lib/api/client';
import { canSync, mergeWinner } from './engine';

type RemoteNote = {
  id: string;
  youtubeVideoId: string;
  type: string;
  title: string;
  content: string;
  tags: string[];
  anchors?: unknown;
  createdAt: number;
  updatedAt: number;
};

function rowToNote(row: NoteRow) {
  return {
    id: row.id,
    videoId: row.videoId,
    type: row.type,
    title: row.title,
    content: row.content,
    format: row.format,
    tags: row.tags,
    isPinned: row.isPinned,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    timestampAnchors: row.timestampAnchors,
  };
}

export async function markNoteDirty(row: NoteRow): Promise<void> {
  await ensureDbReady();
  await getDb().notes.put({ ...row, dirty: true, updatedAt: nowMs() });
}

export async function pushDirtyNotes(videoId?: string): Promise<void> {
  if (!(await canSync())) return;
  await ensureDbReady();
  const db = getDb();
  let rows = await db.notes.filter((r) => !!r.dirty).toArray();
  if (videoId) rows = rows.filter((r) => r.videoId === videoId);

  for (const row of rows) {
    if (row.deleted && row.remoteId) {
      await api.delete(`/api/notes/${row.remoteId}`);
      await db.notes.delete(row.id);
      continue;
    }

    if (row.deleted) {
      await db.notes.delete(row.id);
      continue;
    }

    const payload = {
      youtubeVideoId: row.videoId,
      type: row.type,
      title: row.title,
      content: row.content,
      tags: row.tags,
      anchors: row.timestampAnchors,
      updatedAt: row.updatedAt,
    };

    if (row.remoteId) {
      const resp = await api.patch<{ note: RemoteNote }>(`/api/notes/${row.remoteId}`, payload);
      await db.notes.put({
        ...row,
        remoteId: resp.note.id,
        dirty: false,
        lastSyncedAt: nowMs(),
        updatedAt: resp.note.updatedAt,
      });
    } else {
      const resp = await api.post<{ note: RemoteNote }>('/api/notes', payload);
      await db.notes.put({
        ...row,
        remoteId: resp.note.id,
        dirty: false,
        lastSyncedAt: nowMs(),
        updatedAt: resp.note.updatedAt,
      });
    }
  }
}

export async function pullNotes(videoId?: string): Promise<void> {
  if (!(await canSync())) return;
  await ensureDbReady();
  const db = getDb();
  const path = videoId ? `/api/notes?videoId=${encodeURIComponent(videoId)}` : '/api/notes';
  const resp = await api.get<{ notes: RemoteNote[] }>(path);

  for (const remote of resp.notes) {
    const local = await db.notes
      .where('videoId')
      .equals(remote.youtubeVideoId)
      .filter((r) => r.remoteId === remote.id)
      .first();

    if (local) {
      if (local.dirty && mergeWinner(local.updatedAt, remote.updatedAt) === 'local') continue;
      await db.notes.put({
        ...local,
        type: remote.type as NoteRow['type'],
        title: remote.title,
        content: remote.content,
        tags: remote.tags,
        timestampAnchors: remote.anchors as NoteRow['timestampAnchors'],
        updatedAt: remote.updatedAt,
        remoteId: remote.id,
        dirty: false,
        lastSyncedAt: nowMs(),
      });
      continue;
    }

    const ts = remote.createdAt;
    const id = DbIds.note(remote.youtubeVideoId, `remote_${remote.id}`);
    await db.notes.put({
      id,
      videoId: remote.youtubeVideoId,
      type: remote.type as NoteRow['type'],
      title: remote.title,
      content: remote.content,
      format: 'markdown',
      tags: remote.tags,
      isPinned: false,
      timestampAnchors: remote.anchors as NoteRow['timestampAnchors'],
      createdAt: ts,
      updatedAt: remote.updatedAt,
      schemaVersion: 3,
      remoteId: remote.id,
      dirty: false,
      lastSyncedAt: nowMs(),
    });
  }
}

export { rowToNote };
