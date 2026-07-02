import { DbIds, ensureDbReady, getDb, nowMs, type StudyPlanRow } from '@lib/db';
import { api } from '@lib/api/client';
import { canSync, mergeWinner } from './engine';

type RemoteSession = {
  id: string;
  playlistId: string | null;
  topic: string;
  level: string | null;
  payload: unknown;
  updatedAt: number;
};

export async function pushDirtyStudySessions(playlistId?: string): Promise<void> {
  if (!(await canSync())) return;
  await ensureDbReady();
  const db = getDb();
  let rows = await db.studyPlans.filter((r) => !!r.dirty).toArray();
  if (playlistId) rows = rows.filter((r) => r.playlistId === playlistId);

  for (const row of rows) {
    if (row.deleted && row.remoteId) {
      await api.delete(`/api/study-sessions/${row.remoteId}`);
      await db.studyPlans.delete(row.id);
      continue;
    }
    if (row.deleted) {
      await db.studyPlans.delete(row.id);
      continue;
    }

    const resp = await api.post<{ session: RemoteSession }>('/api/study-sessions', {
      id: row.remoteId,
      playlistId: row.playlistId,
      topic: row.topic,
      level: row.level,
      payload: row,
      updatedAt: row.updatedAt,
    });
    await db.studyPlans.put({
      ...row,
      remoteId: resp.session.id,
      dirty: false,
      lastSyncedAt: nowMs(),
      updatedAt: resp.session.updatedAt,
    });
  }
}

export async function pullStudySessions(playlistId?: string): Promise<void> {
  if (!(await canSync())) return;
  await ensureDbReady();
  const db = getDb();
  const path = playlistId
    ? `/api/study-sessions?playlistId=${encodeURIComponent(playlistId)}`
    : '/api/study-sessions';
  const resp = await api.get<{ sessions: RemoteSession[] }>(path);

  for (const remote of resp.sessions) {
    const local = await db.studyPlans.filter((r) => r.remoteId === remote.id).first();
    const payload = remote.payload as StudyPlanRow;

    if (local) {
      if (local.dirty && mergeWinner(local.updatedAt, remote.updatedAt) === 'local') continue;
      await db.studyPlans.put({
        ...local,
        ...payload,
        id: local.id,
        remoteId: remote.id,
        updatedAt: remote.updatedAt,
        dirty: false,
        lastSyncedAt: nowMs(),
      });
      continue;
    }

    const localId =
      payload?.id ??
      DbIds.studyPlan(
        remote.playlistId ?? payload?.playlistId ?? 'unknown',
        remote.topic.replace(/\s+/g, '_').toLowerCase().slice(0, 40)
      );

    await db.studyPlans.put({
      ...payload,
      id: localId,
      playlistId: remote.playlistId ?? payload?.playlistId ?? '',
      topic: remote.topic,
      level: (remote.level ?? payload?.level ?? 'beginner') as StudyPlanRow['level'],
      updatedAt: remote.updatedAt,
      createdAt: payload?.createdAt ?? remote.updatedAt,
      schemaVersion: payload?.schemaVersion ?? 3,
      remoteId: remote.id,
      dirty: false,
      lastSyncedAt: nowMs(),
    });
  }
}

export async function markStudyPlanDirty(row: StudyPlanRow): Promise<void> {
  await ensureDbReady();
  await getDb().studyPlans.put({ ...row, dirty: true, updatedAt: nowMs() });
}
