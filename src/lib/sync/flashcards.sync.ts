import { DbIds, ensureDbReady, getDb, nowMs, type FlashcardRow } from '@lib/db';
import { api } from '@lib/api/client';
import { canSync, mergeWinner } from './engine';

type RemoteCard = {
  id: string;
  youtubeVideoId: string;
  front: string;
  back: string;
  tags: string[];
  sm2?: unknown;
  nextReviewAt: string | null;
  playlistId?: string;
  updatedAt: number;
};

type Sm2Payload = {
  easeFactor?: number;
  intervalDays?: number;
  repetitions?: number;
  nextReviewDate?: number;
  lastReviewedAt?: number;
};

function parseSm2(sm2: unknown): Pick<
  FlashcardRow,
  'easeFactor' | 'intervalDays' | 'repetitions' | 'nextReviewDate' | 'lastReviewedAt'
> {
  const data = (sm2 ?? {}) as Sm2Payload;
  return {
    easeFactor: data.easeFactor ?? 2.5,
    intervalDays: data.intervalDays ?? 1,
    repetitions: data.repetitions ?? 0,
    nextReviewDate: data.nextReviewDate ?? Date.now(),
    lastReviewedAt: data.lastReviewedAt,
  };
}

function cardPayload(row: FlashcardRow) {
  return {
    id: row.remoteId,
    youtubeVideoId: row.videoId,
    front: row.front,
    back: row.back,
    playlistId: row.playlistId,
    tags: row.playlistId ? [`playlist:${row.playlistId}`] : [],
    sm2: {
      easeFactor: row.easeFactor,
      intervalDays: row.intervalDays,
      repetitions: row.repetitions,
      nextReviewDate: row.nextReviewDate,
      lastReviewedAt: row.lastReviewedAt,
    },
    nextReviewAt: new Date(row.nextReviewDate).toISOString(),
    updatedAt: row.updatedAt,
  };
}

function buildPullPath(opts?: { videoId?: string; playlistId?: string }): string {
  if (opts?.videoId) {
    return `/api/flashcards?videoId=${encodeURIComponent(opts.videoId)}`;
  }
  if (opts?.playlistId) {
    return `/api/flashcards?playlistId=${encodeURIComponent(opts.playlistId)}`;
  }
  return '/api/flashcards';
}

export async function pushDirtyFlashcards(opts?: {
  videoId?: string;
  playlistId?: string;
}): Promise<void> {
  if (!(await canSync())) return;
  await ensureDbReady();
  const db = getDb();
  let rows = await db.flashcards.filter((r) => !!r.dirty).toArray();
  if (opts?.videoId) rows = rows.filter((r) => r.videoId === opts.videoId);
  if (opts?.playlistId) rows = rows.filter((r) => r.playlistId === opts.playlistId);
  if (!rows.length) return;

  const resp = await api.post<{ flashcards: RemoteCard[] }>('/api/flashcards', {
    cards: rows.filter((r) => !r.deleted).map(cardPayload),
  });

  const byRemoteId = new Map(resp.flashcards.map((c) => [c.id, c]));

  for (const row of rows) {
    if (row.deleted && row.remoteId) {
      await api.delete(`/api/flashcards/${row.remoteId}`);
      await db.flashcards.delete(row.id);
      continue;
    }
    if (row.deleted) {
      await db.flashcards.delete(row.id);
      continue;
    }

    const remote =
      (row.remoteId ? byRemoteId.get(row.remoteId) : undefined) ??
      resp.flashcards.find((c) => c.youtubeVideoId === row.videoId && c.front === row.front);
    if (!remote) continue;

    await db.flashcards.put({
      ...row,
      remoteId: remote.id,
      dirty: false,
      lastSyncedAt: nowMs(),
      updatedAt: remote.updatedAt,
    });
  }
}

export async function pullFlashcards(opts?: {
  videoId?: string;
  playlistId?: string;
}): Promise<void> {
  if (!(await canSync())) return;
  await ensureDbReady();
  const db = getDb();
  const resp = await api.get<{ flashcards: RemoteCard[] }>(buildPullPath(opts));

  for (const remote of resp.flashcards) {
    const local = remote.id
      ? await db.flashcards.filter((r) => r.remoteId === remote.id).first()
      : undefined;
    const sm2 = parseSm2(remote.sm2);

    if (local) {
      if (local.dirty && mergeWinner(local.updatedAt, remote.updatedAt) === 'local') continue;
      await db.flashcards.put({
        ...local,
        front: remote.front,
        back: remote.back,
        playlistId: remote.playlistId ?? local.playlistId,
        nextReviewDate: remote.nextReviewAt
          ? new Date(remote.nextReviewAt).getTime()
          : sm2.nextReviewDate,
        easeFactor: sm2.easeFactor,
        intervalDays: sm2.intervalDays,
        repetitions: sm2.repetitions,
        lastReviewedAt: sm2.lastReviewedAt,
        updatedAt: remote.updatedAt,
        remoteId: remote.id,
        dirty: false,
        lastSyncedAt: nowMs(),
      });
      continue;
    }

    await db.flashcards.put({
      id: DbIds.flashcard(remote.youtubeVideoId, remote.id),
      videoId: remote.youtubeVideoId,
      flashcardId: remote.id,
      playlistId: remote.playlistId,
      front: remote.front,
      back: remote.back,
      difficulty: 'medium',
      nextReviewDate: remote.nextReviewAt
        ? new Date(remote.nextReviewAt).getTime()
        : sm2.nextReviewDate,
      intervalDays: sm2.intervalDays,
      repetitions: sm2.repetitions,
      easeFactor: sm2.easeFactor,
      lastReviewedAt: sm2.lastReviewedAt,
      createdAt: remote.updatedAt,
      updatedAt: remote.updatedAt,
      schemaVersion: 3,
      remoteId: remote.id,
      dirty: false,
      lastSyncedAt: nowMs(),
    });
  }
}

export async function markFlashcardDirty(row: FlashcardRow): Promise<void> {
  await ensureDbReady();
  await getDb().flashcards.put({ ...row, dirty: true, updatedAt: nowMs() });
}
