import { create } from 'zustand';
import type { SemanticChunk } from '@/types/ai';
import {
  buildSemanticIndex,
  buildKeywordOnlyIndex,
  indexMetaFromPage,
} from '@/features/ai/ragPipeline.service';
import { usePlaylistStore } from '@/store/playlist.store';
import { friendlyAiError, isGeminiQuotaError } from '@lib/aiErrors';
import { AUTH_DISABLED } from '@lib/config/auth.config';
import { checkBackendHealth } from '@lib/api/client';

interface RagState {
  videoId: string | null;
  chunks: SemanticChunk[];
  status: 'idle' | 'building' | 'ready' | 'error';
  stage: string;
  error: string | null;
  keywordOnly: boolean;
  buildIndex: (videoId: string, enhancedChunks: import('@/types/transcript').EnhancedTranscriptChunk[]) => Promise<void>;
  reset: () => void;
}

export const useRagStore = create<RagState>((set, get) => ({
  videoId: null,
  chunks: [],
  status: 'idle',
  stage: '',
  error: null,
  keywordOnly: false,

  buildIndex: async (videoId, enhancedChunks) => {
    if (!enhancedChunks.length) return;
    const state = get();
    if (state.videoId === videoId && state.status === 'building') return;
    if (state.videoId === videoId && state.status === 'ready' && state.chunks.length) return;

    set({ videoId, status: 'building', error: null, stage: 'Starting…', keywordOnly: false });
    try {
      const meta = indexMetaFromPage();
      const backendOnline = await checkBackendHealth();

      // TODO: Re-enable auth check when AUTH_DISABLED is false.
      if (!AUTH_DISABLED) {
        const { isAuthenticated } = await import('@lib/api/auth');
        const authed = await isAuthenticated();
        if (!authed) {
          const chunks = await buildKeywordOnlyIndex(videoId, enhancedChunks, (stage) =>
            set({ stage }), meta
          );
          void usePlaylistStore.getState().registerCurrentVideo(videoId, meta.videoTitle);
          void usePlaylistStore.getState().refreshPlaylistChunks();
          set({
            chunks,
            status: 'ready',
            stage: 'Transcript indexed — sign in for AI features',
            keywordOnly: true,
          });
          return;
        }
      }

      if (!backendOnline) {
        const chunks = await buildKeywordOnlyIndex(videoId, enhancedChunks, (stage) =>
          set({ stage }), meta
        );
        void usePlaylistStore.getState().registerCurrentVideo(videoId, meta.videoTitle);
        void usePlaylistStore.getState().refreshPlaylistChunks();
        set({
          chunks,
          status: 'ready',
          stage: 'Backend offline — keyword search only',
          keywordOnly: true,
        });
        return;
      }

      const chunks = await buildSemanticIndex(videoId, enhancedChunks, (stage) =>
        set({ stage }), meta
      );
      void usePlaylistStore.getState().registerCurrentVideo(videoId, meta.videoTitle);
      void usePlaylistStore.getState().refreshPlaylistChunks();
      set({
        chunks,
        status: 'ready',
        stage: 'Vector RAG ready (Pinecone)',
        keywordOnly: false,
      });
    } catch (e) {
      if (isGeminiQuotaError(e)) {
        try {
          const chunks = await buildKeywordOnlyIndex(videoId, enhancedChunks, (stage) =>
            set({ stage }), indexMetaFromPage()
          );
          set({
            chunks,
            status: 'ready',
            stage: 'Local mode — Gemini quota or rate limit exceeded',
            keywordOnly: true,
            error: null,
          });
          return;
        } catch {
          // fall through
        }
      }
      set({
        status: 'error',
        error: friendlyAiError(e),
        stage: '',
      });
    }
  },

  reset: () =>
    set({ videoId: null, chunks: [], status: 'idle', stage: '', error: null, keywordOnly: false }),
}));
