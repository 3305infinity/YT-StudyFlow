import { useMemo } from 'react';
import { useTranscriptStore } from '@/features/transcript/transcript.store';
import { useRagStore } from '@/store/rag.store';
import { useAuthStore } from '@/store/auth.store';
import { AUTH_DISABLED } from '@lib/config/auth.config';

export type AiReadiness =
  | { state: 'no-auth'; message: string }
  | { state: 'loading-transcript'; message: string }
  | { state: 'no-transcript'; message: string }
  | { state: 'building-index'; message: string; stage?: string }
  | { state: 'index-error'; message: string }
  | { state: 'ready'; chunkCount: number; keywordOnly?: boolean };

export function useAiReadiness(): AiReadiness {
  const user = useAuthStore((s) => s.user);
  const authLoaded = useAuthStore((s) => s.loaded);
  const transcriptStatus = useTranscriptStore((s) => s.status);
  const transcriptLoading = useTranscriptStore((s) => s.loading);
  const enhancedCount = useTranscriptStore((s) => s.enhancedChunks.length);
  const ragStatus = useRagStore((s) => s.status);
  const ragStage = useRagStore((s) => s.stage);
  const ragError = useRagStore((s) => s.error);
  const chunkCount = useRagStore((s) => s.chunks.length);
  const keywordOnly = useRagStore((s) => s.keywordOnly);

  return useMemo(() => {
    let result: AiReadiness;
    if (!authLoaded) {
      result = { state: 'loading-transcript', message: 'Initializing workspace…' };
    } else if (!AUTH_DISABLED && !user) {
      result = {
        state: 'no-auth',
        message: 'Sign in to unlock AI chat, notes, quizzes, and vector search.',
      };
    } else if (transcriptLoading || transcriptStatus === 'loading' || transcriptStatus === 'idle') {
      result = { state: 'loading-transcript', message: 'Loading transcript…' };
    } else if (transcriptStatus === 'no-transcript' || transcriptStatus === 'error') {
      result = {
        state: 'no-transcript',
        message: 'Transcript required. Enable CC on the video or retry in the Transcript tab.',
      };
    } else if (!enhancedCount) {
      result = { state: 'no-transcript', message: 'Waiting for transcript segments…' };
    } else if (ragStatus === 'building') {
      result = {
        state: 'building-index',
        message: 'Building index from transcript…',
        stage: ragStage,
      };
    } else if (ragStatus === 'error') {
      result = {
        state: 'index-error',
        message: ragError ?? 'Failed to build index.',
      };
    } else if (ragStatus === 'ready' && chunkCount > 0) {
      result = { state: 'ready', chunkCount, keywordOnly };
    } else {
      result = { state: 'building-index', message: 'Preparing index…', stage: ragStage };
    }

    console.log('[AI READINESS DEBUG]', {
      state: result.state,
      authLoaded,
      transcriptStatus,
      transcriptLoading,
      enhancedCount,
      ragStatus,
      ragStage,
      chunkCount,
    });

    return result;
  }, [
    user,
    authLoaded,
    transcriptStatus,
    transcriptLoading,
    enhancedCount,
    ragStatus,
    ragStage,
    ragError,
    chunkCount,
    keywordOnly,
  ]);
}

export function useHasApiKey(): boolean {
  const user = useAuthStore((s) => s.user);
  return !!user;
}

export async function useCanUseAi(): Promise<boolean> {
  if (AUTH_DISABLED) return true;
  const { isAuthenticated } = await import('@lib/api/auth');
  return isAuthenticated();
}
