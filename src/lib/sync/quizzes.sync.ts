import { DbIds, ensureDbReady, getDb, nowMs, type QuizRow } from '@lib/db';
import { api } from '@lib/api/client';
import { canSync, mergeWinner } from './engine';

type RemoteQuiz = {
  id: string;
  youtubeVideoId: string;
  mode: string;
  questions: QuizRow['questions'];
  updatedAt: number;
};

export async function pushDirtyQuizzes(videoId?: string): Promise<void> {
  if (!(await canSync())) return;
  await ensureDbReady();
  const db = getDb();
  let rows = await db.quizzes.filter((r) => !!r.dirty).toArray();
  if (videoId) rows = rows.filter((r) => r.videoId === videoId);

  for (const row of rows) {
    if (row.deleted && row.remoteId) {
      await api.delete(`/api/quizzes/${row.remoteId}`);
      await db.quizzes.delete(row.id);
      continue;
    }
    if (row.deleted) {
      await db.quizzes.delete(row.id);
      continue;
    }
    const resp = await api.post<{ quiz: RemoteQuiz }>('/api/quizzes', {
      id: row.remoteId,
      youtubeVideoId: row.videoId,
      mode: row.mode,
      questions: row.questions,
      updatedAt: row.updatedAt,
    });
    await db.quizzes.put({
      ...row,
      remoteId: resp.quiz.id,
      dirty: false,
      lastSyncedAt: nowMs(),
      updatedAt: resp.quiz.updatedAt,
    });
  }
}

export async function pullQuizzes(videoId?: string): Promise<void> {
  if (!(await canSync())) return;
  await ensureDbReady();
  const db = getDb();
  const path = videoId ? `/api/quizzes?videoId=${encodeURIComponent(videoId)}` : '/api/quizzes';
  const resp = await api.get<{ quizzes: RemoteQuiz[] }>(path);

  for (const remote of resp.quizzes) {
    const local = await db.quizzes.filter((r) => r.remoteId === remote.id).first();
    if (local) {
      if (local.dirty && mergeWinner(local.updatedAt, remote.updatedAt) === 'local') continue;
      await db.quizzes.put({
        ...local,
        mode: remote.mode as QuizRow['mode'],
        questions: remote.questions,
        updatedAt: remote.updatedAt,
        dirty: false,
        lastSyncedAt: nowMs(),
      });
      continue;
    }

    await db.quizzes.put({
      id: DbIds.quiz(remote.youtubeVideoId, `remote_${remote.id}`),
      videoId: remote.youtubeVideoId,
      quizId: remote.id,
      mode: remote.mode as QuizRow['mode'],
      title: 'Synced Quiz',
      questions: remote.questions,
      createdAt: remote.updatedAt,
      updatedAt: remote.updatedAt,
      schemaVersion: 3,
      remoteId: remote.id,
      dirty: false,
      lastSyncedAt: nowMs(),
    });
  }
}

export async function markQuizDirty(row: QuizRow): Promise<void> {
  await ensureDbReady();
  await getDb().quizzes.put({ ...row, dirty: true, updatedAt: nowMs() });
}
