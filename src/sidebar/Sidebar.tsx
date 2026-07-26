import { useEffect, useMemo } from 'react';
import { SidebarLayout } from './SidebarLayout';
import { useVideo } from '@/hooks/useVideo';
import { useTranscript } from '@/hooks/useTranscript';
import { usePlaylistStore } from '@store/playlist.store';

export interface SidebarProps {
  videoId: string;
}

export function Sidebar({ videoId }: SidebarProps) {
  const { loadVideo } = useVideo(videoId);
  const { loadTranscript } = useTranscript(videoId);

  const onReloadTranscript = useMemo(() => () => void loadTranscript(), [loadTranscript]);

  useEffect(() => {
    void loadVideo();
    void usePlaylistStore.getState().syncFromPage();
  }, [videoId, loadVideo]);

  return (
    <SidebarLayout
      videoId={videoId}
      onReloadTranscript={onReloadTranscript}
    />
  );
}
