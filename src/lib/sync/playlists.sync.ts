import { DbIds, ensureDbReady, getDb, nowMs, type PlaylistRow } from '@lib/db';
import { api } from '@lib/api/client';
import { canSync, mergeWinner } from './engine';

type RemotePlaylist = {
  id: string;
  youtubeId: string;
  title: string | null;
  videoIds: string[];
  updatedAt: number;
};

export async function pushDirtyPlaylists(): Promise<void> {
  if (!(await canSync())) return;
  await ensureDbReady();
  const db = getDb();
  const rows = await db.playlists.filter((r) => !!r.dirty).toArray();

  for (const row of rows) {
    if (row.deleted && row.remoteId) {
      await api.delete(`/api/playlists/${row.remoteId}`);
      await db.playlists.delete(row.id);
      continue;
    }
    if (row.deleted) {
      await db.playlists.delete(row.id);
      continue;
    }

    const youtubeId = row.id.replace(/^playlist\|/, '');
    const resp = await api.post<{ playlist: RemotePlaylist }>('/api/playlists', {
      id: row.remoteId,
      youtubeId,
      title: row.title,
      videoIds: row.videoIds,
      updatedAt: row.updatedAt,
    });
    await db.playlists.put({
      ...row,
      remoteId: resp.playlist.id,
      dirty: false,
      lastSyncedAt: nowMs(),
      updatedAt: resp.playlist.updatedAt,
    });
  }
}

export async function pullPlaylists(): Promise<void> {
  if (!(await canSync())) return;
  await ensureDbReady();
  const db = getDb();
  const resp = await api.get<{ playlists: RemotePlaylist[] }>('/api/playlists');

  for (const remote of resp.playlists) {
    const localId = DbIds.playlist(remote.youtubeId);
    const local = await db.playlists.get(localId);

    if (local) {
      if (local.dirty && mergeWinner(local.updatedAt, remote.updatedAt) === 'local') continue;
      await db.playlists.put({
        ...local,
        title: remote.title ?? local.title,
        videoIds: remote.videoIds,
        updatedAt: remote.updatedAt,
        remoteId: remote.id,
        dirty: false,
        lastSyncedAt: nowMs(),
      });
      continue;
    }

    await db.playlists.put({
      id: localId,
      title: remote.title ?? 'Playlist',
      videoIds: remote.videoIds,
      videoTitles: {},
      createdAt: remote.updatedAt,
      updatedAt: remote.updatedAt,
      schemaVersion: 3,
      remoteId: remote.id,
      dirty: false,
      lastSyncedAt: nowMs(),
    });
  }
}

export async function markPlaylistDirty(row: PlaylistRow): Promise<void> {
  await ensureDbReady();
  await getDb().playlists.put({ ...row, dirty: true, updatedAt: nowMs() });
}
