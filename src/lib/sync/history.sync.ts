import { DbIds, ensureDbReady, getDb, nowMs, type ChatHistoryRow } from '@lib/db';
import { api } from '@lib/api/client';
import { canSync, mergeWinner } from './engine';
import type { ChatMessage } from '@/types/ai';

type RemoteMessage = {
  id: string;
  youtubeVideoId: string | null;
  role: string;
  content: string;
  citations?: unknown;
  updatedAt: number;
  createdAt: number;
};

export function chatRowToMessage(row: ChatHistoryRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    citations: row.citations as ChatMessage['citations'],
    timestamp: row.timestamp,
  };
}

export async function cacheChatMessage(
  videoId: string,
  message: ChatMessage
): Promise<void> {
  await ensureDbReady();
  const ts = message.timestamp ?? nowMs();
  const row: ChatHistoryRow = {
    id: message.id.startsWith('msg_') ? DbIds.chatMessage(videoId, message.id) : message.id,
    videoId,
    role: message.role,
    content: message.content,
    citations: message.citations,
    timestamp: ts,
    createdAt: ts,
    updatedAt: ts,
    schemaVersion: 3,
    dirty: true,
  };
  await getDb().chatHistory.put(row);
}

export async function loadChatHistory(videoId: string): Promise<ChatMessage[]> {
  await ensureDbReady();
  const rows = await getDb().chatHistory.where('videoId').equals(videoId).sortBy('createdAt');
  return rows.filter((r) => !r.deleted).map(chatRowToMessage);
}

export async function pushDirtyHistory(videoId?: string): Promise<void> {
  if (!(await canSync())) return;
  await ensureDbReady();
  const db = getDb();
  let rows = await db.chatHistory.filter((r) => !!r.dirty && !!r.content).toArray();
  if (videoId) rows = rows.filter((r) => r.videoId === videoId);
  if (!rows.length) return;

  const resp = await api.post<{ messages: RemoteMessage[] }>('/api/history', {
    messages: rows.map((row) => ({
      id: row.remoteId,
      youtubeVideoId: row.videoId,
      role: row.role,
      content: row.content,
      citations: row.citations,
      updatedAt: row.updatedAt,
    })),
  });

  for (const remote of resp.messages) {
    const local = rows.find((r) => r.remoteId === remote.id || r.content === remote.content);
    if (!local) continue;
    await db.chatHistory.put({
      ...local,
      remoteId: remote.id,
      dirty: false,
      lastSyncedAt: nowMs(),
      updatedAt: remote.updatedAt,
    });
  }
}

export async function pullHistory(videoId?: string): Promise<void> {
  if (!(await canSync())) return;
  await ensureDbReady();
  const db = getDb();
  const path = videoId ? `/api/history?videoId=${encodeURIComponent(videoId)}` : '/api/history';
  const resp = await api.get<{ messages: RemoteMessage[] }>(path);

  for (const remote of resp.messages) {
    if (!remote.youtubeVideoId) continue;
    const local = await db.chatHistory.filter((r) => r.remoteId === remote.id).first();
    if (local) {
      if (local.dirty && mergeWinner(local.updatedAt, remote.updatedAt) === 'local') continue;
      await db.chatHistory.put({
        ...local,
        content: remote.content,
        citations: remote.citations as ChatHistoryRow['citations'],
        updatedAt: remote.updatedAt,
        dirty: false,
        lastSyncedAt: nowMs(),
      });
      continue;
    }

    await db.chatHistory.put({
      id: DbIds.chatMessage(remote.youtubeVideoId, remote.id),
      videoId: remote.youtubeVideoId,
      role: remote.role as ChatHistoryRow['role'],
      content: remote.content,
      citations: remote.citations as ChatHistoryRow['citations'],
      timestamp: remote.createdAt,
      createdAt: remote.createdAt,
      updatedAt: remote.updatedAt,
      schemaVersion: 3,
      remoteId: remote.id,
      dirty: false,
      lastSyncedAt: nowMs(),
    });
  }
}

export async function clearChatHistoryLocal(videoId: string): Promise<void> {
  await ensureDbReady();
  if (await canSync()) {
    try {
      await api.delete(`/api/history?videoId=${encodeURIComponent(videoId)}`);
    } catch {
      // offline — local clear only
    }
  }
  await getDb().chatHistory.where('videoId').equals(videoId).delete();
}
