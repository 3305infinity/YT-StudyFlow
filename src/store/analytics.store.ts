import { create } from 'zustand';
import type { ConfusionZone, HeatmapBucket } from '@/types/ai';
import type { LearningEvent, SessionStats } from '@/features/heatmap/density';
import { computeSessionStats } from '@/features/heatmap/density';

interface AnalyticsState {
  videoId: string | null;
  events: LearningEvent[];
  zones: ConfusionZone[];
  buckets: HeatmapBucket[];
  duration: number;
  quizAccuracy: number | null;
  flashcardsReviewed: number;
  setSession: (params: {
    videoId: string;
    events?: LearningEvent[];
    zones?: ConfusionZone[];
    buckets?: HeatmapBucket[];
    duration?: number;
  }) => void;
  setQuizAccuracy: (accuracy: number | null) => void;
  setFlashcardsReviewed: (count: number) => void;
  getStats: () => SessionStats;
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  videoId: null,
  events: [],
  zones: [],
  buckets: [],
  duration: 0,
  quizAccuracy: null,
  flashcardsReviewed: 0,

  setSession: (params) =>
    set((s) => ({
      videoId: params.videoId,
      events: params.events ?? s.events,
      zones: params.zones ?? s.zones,
      buckets: params.buckets ?? s.buckets,
      duration: params.duration ?? s.duration,
    })),

  setQuizAccuracy: (quizAccuracy) => set({ quizAccuracy }),
  setFlashcardsReviewed: (flashcardsReviewed) => set({ flashcardsReviewed }),

  getStats: () => computeSessionStats(get().events, get().duration),
}));
