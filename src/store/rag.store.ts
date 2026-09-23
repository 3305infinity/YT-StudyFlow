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
import { isDifferentVideoNavigated, getCurrentVideoId } from '@lib/youtube';

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
    console.log('[RAG STORE DEBUG] buildIndex called:', {
      videoId,
      chunkCount: enhancedChunks.length,
    });
    if (!enhancedChunks.length) return;
    const state = get();
    if (state.videoId === videoId && state.status === 'building') {
      console.log('[RAG STORE DEBUG] already building for videoId:', videoId);
      return;
    }
    if (state.videoId === videoId && state.status === 'ready' && state.chunks.length) {
      console.log('[RAG STORE DEBUG] already ready for videoId:', videoId);
      return;
    }

    set({ videoId, status: 'building', error: null, stage: 'Starting…', keywordOnly: false });

    const navGuard = (label: string): boolean => {
      const different = isDifferentVideoNavigated(videoId);
      console.log(`[RAG PIPELINE DEBUG] navigation guard @ ${label}`, {
        targetVideoId: videoId,
        currentVideoId: getCurrentVideoId(),
        differentVideo: different,
      });
      if (different) {
        set({ status: 'idle', stage: '', error: null });
      }
      return different;
    };

    try {
      const meta = indexMetaFromPage();
      if (navGuard('indexMetaFromPage')) return;

      console.log('[RAG STORE DEBUG] checking backend health…');
      const backendOnline = await checkBackendHealth();
      console.log('[RAG STORE DEBUG] backend online:', backendOnline);
      if (navGuard('checkBackendHealth')) return;

      // TODO: Re-enable auth check when AUTH_DISABLED is false.
      if (!AUTH_DISABLED) {
        if (navGuard('auth-pre-check')) return;
        const { isAuthenticated } = await import('@lib/api/auth');
        const authed = await isAuthenticated();
        if (navGuard('isAuthenticated')) return;
        if (!authed) {
          const chunks = await buildKeywordOnlyIndex(videoId, enhancedChunks, (stage) =>
            set({ stage }), meta
          );
          if (navGuard('keyword-unauthd')) return;
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
        console.log('[RAG STORE DEBUG] backend offline — using keyword-only index');
        const chunks = await buildKeywordOnlyIndex(videoId, enhancedChunks, (stage) =>
          set({ stage }), meta
        );
        if (navGuard('keyword-backend-offline')) return;
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

      console.log('[RAG STORE DEBUG] starting semantic index (Pinecone)…');
      const chunks = await buildSemanticIndex(videoId, enhancedChunks, (stage) => {
        console.log('[RAG STORE DEBUG] semantic stage:', stage);
        set({ stage });
      }, meta);
      if (navGuard('buildSemanticIndex-done')) return;
      void usePlaylistStore.getState().registerCurrentVideo(videoId, meta.videoTitle);
      void usePlaylistStore.getState().refreshPlaylistChunks();
      console.log('[RAG STORE DEBUG] ✅ RAG ready — chunks:', chunks.length);
      set({
        chunks,
        status: 'ready',
        stage: 'Vector RAG ready (Pinecone)',
        keywordOnly: false,
      });
    } catch (e) {
      if (isGeminiQuotaError(e)) {
        if (navGuard('gemini-quota-catch')) return;
        try {
          const chunks = await buildKeywordOnlyIndex(videoId, enhancedChunks, (stage) =>
            set({ stage }), indexMetaFromPage()
          );
          if (navGuard('keyword-quota-fallback')) return;
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
      if (navGuard('error-handler')) return;
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
