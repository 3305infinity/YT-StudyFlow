import { useCallback, useEffect, useRef } from 'react';
import {
  getChannelNameFromPage,
  getCurrentVideoId,
  getVideoDurationFromPlayer,
  getVideoTitleFromPage,
} from '@lib/youtube';
import { STUDYFLOW_EVENTS } from '@lib/constants';
import { useVideoStore } from '@store/video.store';

export function useVideo(videoId: string) {
  const { setVideo, setMetadata, setCurrentTime } = useVideoStore();

  useEffect(() => {
    if (!videoId) return;
    setVideo(videoId);
  }, [videoId, setVideo]);

  const loadVideo = useCallback(async () => {
    if (!videoId) return;

    const currentId = getCurrentVideoId();
    if (currentId !== videoId) return;

    const title = getVideoTitleFromPage();
    const channel = getChannelNameFromPage();
    const duration = getVideoDurationFromPlayer();

    const currentIdAfter = getCurrentVideoId();
    if (currentIdAfter !== videoId) return;

    if (useVideoStore.getState().videoId !== videoId) return;

    setMetadata({ title, channel, duration });

    if (title != null && channel != null && duration > 0) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (pollCapRef.current) {
        clearTimeout(pollCapRef.current);
        pollCapRef.current = null;
      }
      if (t1Ref.current) {
        clearTimeout(t1Ref.current);
        t1Ref.current = null;
      }
      if (t2Ref.current) {
        clearTimeout(t2Ref.current);
        t2Ref.current = null;
      }
      if (t3Ref.current) {
        clearTimeout(t3Ref.current);
        t3Ref.current = null;
      }
    }
  }, [videoId, setMetadata]);

  useEffect(() => {
    const onTime = (e: Event) => {
      const detail = (e as CustomEvent<{ currentTime: number; videoId: string; duration?: number }>)
        .detail;
      if (!detail || detail.videoId !== videoId) return;

      setCurrentTime(detail.currentTime);
    };

    const onDuration = (e: Event) => {
      const detail = (e as CustomEvent<{ duration: number; videoId: string }>).detail;
      if (!detail || detail.videoId !== videoId || !(detail.duration > 0)) return;

      const currentId = getCurrentVideoId();
      if (currentId !== videoId) return;

      setMetadata({ duration: detail.duration });
    };

    const onAdEnded = (e: Event) => {
      const detail = (e as CustomEvent<{ videoId: string }>).detail;
      if (!detail || detail.videoId !== videoId) return;
      void loadVideo();
    };

    window.addEventListener(STUDYFLOW_EVENTS.TIME_UPDATE, onTime);
    window.addEventListener(STUDYFLOW_EVENTS.DURATION_UPDATE, onDuration);
    window.addEventListener(STUDYFLOW_EVENTS.AD_ENDED, onAdEnded);
    return () => {
      window.removeEventListener(STUDYFLOW_EVENTS.TIME_UPDATE, onTime);
      window.removeEventListener(STUDYFLOW_EVENTS.DURATION_UPDATE, onDuration);
      window.removeEventListener(STUDYFLOW_EVENTS.AD_ENDED, onAdEnded);
    };
  }, [videoId, setCurrentTime, setMetadata, loadVideo]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCapRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t1Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t2Ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t3Ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    t1Ref.current = setTimeout(() => void loadVideo(), 800);
    t2Ref.current = setTimeout(() => void loadVideo(), 2000);
    t3Ref.current = setTimeout(() => void loadVideo(), 5000);

    pollRef.current = setInterval(() => {
      void loadVideo();
    }, 3000);

    pollCapRef.current = setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    }, 45_000);

    return () => {
      if (t1Ref.current) clearTimeout(t1Ref.current);
      if (t2Ref.current) clearTimeout(t2Ref.current);
      if (t3Ref.current) clearTimeout(t3Ref.current);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      if (pollCapRef.current) clearTimeout(pollCapRef.current);
      pollCapRef.current = null;
    };
  }, [loadVideo]);

  return { loadVideo };
}
