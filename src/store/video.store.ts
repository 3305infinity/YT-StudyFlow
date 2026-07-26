import { create } from 'zustand';

interface VideoState {
  videoId: string | null;
  title: string | null;
  channel: string | null;
  duration: number;
  currentTime: number;
  setVideo: (videoId: string) => void;
  setMetadata: (meta: {
    title?: string | null;
    channel?: string | null;
    duration?: number;
  }) => void;
  setCurrentTime: (time: number) => void;
  reset: () => void;
}

export const useVideoStore = create<VideoState>((set, get) => ({
  videoId: null,
  title: null,
  channel: null,
  duration: 0,
  currentTime: 0,

  setVideo: (videoId) => {
    set({ videoId });
  },

  setMetadata: (meta) => {
    const prev = get();
    const next = {
      title: meta.title ?? prev.title,
      channel: meta.channel ?? prev.channel,
      duration: meta.duration ?? prev.duration,
    };
    if (
      next.title === prev.title &&
      next.channel === prev.channel &&
      next.duration === prev.duration
    ) {
      return;
    }
    set(next);
  },

  setCurrentTime: (time) => set({ currentTime: time }),

  reset: () => {
    set({
      videoId: null,
      title: null,
      channel: null,
      duration: 0,
      currentTime: 0,
    });
  },
}));
