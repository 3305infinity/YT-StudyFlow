/**
 * Content script bootstrap — SPA-aware sidebar injection on YouTube watch pages.
 *
 * Lifecycle per video:
 *   1. teardown() — remove ALL old listeners synchronously
 *   2. resetAllStores() — clear video-specific state
 *   3. injectSidebar() — mount React tree for new videoId
 *   4. setupYouTubeEventTracking() — attach player listeners for new videoId
 *   5. startConfusionTracker() — attach analytics for new videoId
 *
 * No setTimeout debounce. Cleanup is synchronous.
 * Three detectors (popstate, yt-navigate-finish, MutationObserver) all funnel
 * into a single activateVideo() with URL-based dedup via lastKey.
 */

import { injectSidebar } from './injectSidebar';
import { setupYouTubeEventTracking } from './youtubeEvents';
import { startConfusionTracker, stopConfusionTracker } from '@/features/confusion/confusionTracker';
import { getCurrentVideoId, isYouTubeWatchPage } from '@lib/youtube';
import { useVideoStore } from '@store/video.store';
import { useRagStore } from '@store/rag.store';
import { useChatStore } from '@/features/chat/chat.store';
import { useTranscriptStore } from '@/features/transcript/transcript.store';
import { useNotesStore } from '@/features/notes/notes.store';
import { useRevisionStore } from '@/features/revision/revision.store';
import { useAnalyticsStore } from '@store/analytics.store';
import { usePlaylistStore } from '@store/playlist.store';
import { usePipelineStore } from '@store/pipeline.store';

const HOST_ID = 'yt-studyflow-host';

let currentVideoId: string | null = null;
let cleanupEvents: (() => void) | null = null;
let cleanupConfusion: (() => void) | null = null;

function resetAllStores(): void {
  useVideoStore.getState().reset();
  useRagStore.getState().reset();
  useChatStore.getState().clear();
  useTranscriptStore.getState().setVideoId('');
  useNotesStore.setState({ notes: [], loading: false, error: null });
  useRevisionStore.setState({
    flashcards: [],
    quiz: [],
    loading: false,
    error: null,
    flipped: false,
    currentCardIndex: 0,
    quizIndex: 0,
    quizAnswers: {},
  });
  useAnalyticsStore.setState({
    videoId: null,
    events: [],
    zones: [],
    buckets: [],
    duration: 0,
    quizAccuracy: null,
    flashcardsReviewed: 0,
  });
  usePlaylistStore.setState({
    playlist: null,
    scope: 'video',
    playlistChunks: [],
    indexedVideoCount: 0,
    loading: false,
  });
  usePipelineStore.getState().reset();
}

function teardown(): void {
  if (cleanupEvents) {
    cleanupEvents();
    cleanupEvents = null;
  }
  if (cleanupConfusion) {
    cleanupConfusion();
    cleanupConfusion = null;
  }
}

function activateVideo(videoId: string): void {
  if (videoId === currentVideoId) return;

  teardown();
  resetAllStores();

  currentVideoId = videoId;
  injectSidebar(videoId);
  cleanupEvents = setupYouTubeEventTracking(videoId);
  cleanupConfusion = startConfusionTracker(videoId);
}

function onNavigate(): void {
  if (!isYouTubeWatchPage()) return;

  const videoId = getCurrentVideoId();
  if (!videoId) return;

  activateVideo(videoId);
}

function watchNavigation(): void {
  onNavigate();

  const urlKey = () => location.pathname + location.search + location.hash;
  let lastKey = urlKey();

  const handleUrlChange = () => {
    const key = urlKey();
    if (key === lastKey) return;
    lastKey = key;
    onNavigate();
  };

  window.addEventListener('popstate', handleUrlChange);
  window.addEventListener('yt-navigate-finish', handleUrlChange);

  const observer = new MutationObserver((mutations) => {
    const key = urlKey();
    if (key !== lastKey) {
      lastKey = key;
      onNavigate();
      return;
    }

    const fromSidebar = mutations.some((m) => {
      const el = m.target as Node;
      return el instanceof Element && (el.closest(`#${HOST_ID}`) || el.id === HOST_ID);
    });
    if (fromSidebar) return;
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener('beforeunload', () => {
    teardown();
    stopConfusionTracker();
    observer.disconnect();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', watchNavigation);
} else {
  watchNavigation();
}

export {};
