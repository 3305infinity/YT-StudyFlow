import { useCallback, useEffect, useRef } from 'react';
import { sendChatMessage, type ChatMode } from '@/features/chat/chat.service';
import { useRagStore } from '@/store/rag.store';
import { usePlaylistStore } from '@/store/playlist.store';
import { useVideoStore } from '@/store/video.store';
import { useChatStore } from '@/features/chat/chat.store';
import { loadChatHistory, clearChatHistoryLocal } from '@/lib/sync/history.sync';
import { CLOUD_SYNC_DISABLED } from '@lib/config/sync.config';

export function useChat() {
  const videoChunks = useRagStore((s) => s.chunks);
  const scope = usePlaylistStore((s) => s.scope);
  const playlistChunks = usePlaylistStore((s) => s.playlistChunks);
  const playlistId = usePlaylistStore((s) => s.playlist?.playlistId);
  const chunks = scope === 'playlist' && playlistChunks.length ? playlistChunks : videoChunks;
  const ragStatus = useRagStore((s) => s.status);
  const { messages, loading, error } = useChatStore();
  const title = useVideoStore((s) => s.title);
  const videoId = useVideoStore((s) => s.videoId);
  const historyLoadRef = useRef(0);

  useEffect(() => {
    if (!videoId) return;
    const loadId = ++historyLoadRef.current;

    void (async () => {
      // TODO: Re-enable syncVideoScope when CLOUD_SYNC_DISABLED=false.
      if (!CLOUD_SYNC_DISABLED) {
        try {
          const { syncVideoScope } = await import('@/lib/sync/engine');
          await syncVideoScope(videoId);
        } catch {
          // offline cache only
        }
      }

      if (loadId !== historyLoadRef.current) return;
      if (useChatStore.getState().loading) return;

      const history = await loadChatHistory(videoId);
      if (loadId !== historyLoadRef.current) return;
      if (useChatStore.getState().loading) return;

      useChatStore.getState().setMessages(history);
    })();
  }, [videoId]);

  const send = useCallback(
    async (question: string, mode: ChatMode = 'concise') => {
      if (!videoId) throw new Error('No video loaded');
      if (!chunks.length) {
        throw new Error(
          scope === 'playlist'
            ? 'Playlist index empty — open more videos in this playlist to index them'
            : 'Semantic index not ready'
        );
      }
      return sendChatMessage({
        question,
        videoId,
        videoTitle: title ?? undefined,
        semanticChunks: chunks,
        mode,
        playlistId: scope === 'playlist' ? playlistId : undefined,
      });
    },
    [videoId, title, chunks, scope, playlistId]
  );

  const clear = useCallback(() => {
    if (videoId) void clearChatHistoryLocal(videoId);
    useChatStore.getState().clear();
  }, [videoId]);

  return { messages, loading, error, send, clear, ragStatus, indexReady: chunks.length > 0 };
}
