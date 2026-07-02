import { create } from 'zustand';
import type { PipelineStage } from '@/types/chat';
import { PIPELINE_LABELS } from '@/types/chat';

interface PipelineState {
  stage: PipelineStage;
  message: string;
  error: string | null;
  setStage: (stage: PipelineStage, customMessage?: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const usePipelineStore = create<PipelineState>((set) => ({
  stage: 'idle',
  message: '',
  error: null,

  setStage: (stage, customMessage) =>
    set({
      stage,
      message: customMessage ?? PIPELINE_LABELS[stage],
      error: null,
    }),

  setError: (error) =>
    set({
      stage: error ? 'error' : 'idle',
      message: error ?? '',
      error,
    }),

  reset: () => set({ stage: 'idle', message: '', error: null }),
}));
