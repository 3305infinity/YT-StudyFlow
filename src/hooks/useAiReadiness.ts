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
    if (!authLoaded) {
      return { state: 'loading-transcript', message: 'Loading…' };
    }

    // TODO: Re-enable auth gate when AUTH_DISABLED is false.
    if (!AUTH_DISABLED && !user) {
      return {
        state: 'no-auth',
        message: 'Sign in to unlock AI chat, notes, quizzes, and vector search.',
      };
    }

    if (transcriptLoading || transcriptStatus === 'loading' || transcriptStatus === 'idle') {
      return { state: 'loading-transcript', message: 'Loading transcript…' };
    }

    if (transcriptStatus === 'no-transcript' || transcriptStatus === 'error') {
      return {
        state: 'no-transcript',
        message: 'Transcript required. Enable CC on the video or retry in the Transcript tab.',
      };
    }

    if (!enhancedCount) {
      return { state: 'no-transcript', message: 'Waiting for transcript segments…' };
    }

    if (ragStatus === 'building') {
      return {
        state: 'building-index',
        message: 'Building index from transcript…',
        stage: ragStage,
      };
    }

    if (ragStatus === 'error') {
      return {
        state: 'index-error',
        message: ragError ?? 'Failed to build index.',
      };
    }

    if (ragStatus === 'ready' && chunkCount > 0) {
      return { state: 'ready', chunkCount, keywordOnly };
    }

    return { state: 'building-index', message: 'Preparing index…', stage: ragStage };
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
