import { useMemo, useEffect } from 'react';
import { FileText, Settings, X } from 'lucide-react';

import { TranscriptPanel } from '@/features/transcript/TranscriptPanel';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { NotesPanel } from '@/features/notes/NotesPanel';
import { RevisionPanel } from '@/features/revision/RevisionPanel';
import { AnalyticsPanel } from '@/features/confusion/ConfusionBanner';
import { ExportPanel } from '@/features/export/ExportPanel';
import { SettingsPanel } from '@/pages/Settings';
import { Tabs } from '@/components/Tabs';
import { LanguageSelector } from '@/components/LanguageSelector';
import { seekTo, formatTime } from '@lib/youtube';
import { watchUrlFor } from '@lib/playlist';
import { usePlaylistStore } from '@/store/playlist.store';
import { useVideoStore } from '@store/video.store';
import { useUiStore, type WorkspaceTab } from '@store/ui.store';
import { useRagPipeline } from '@/hooks/useRagPipeline';
import { useAuthStore } from '@/store/auth.store';
import { useRagStore } from '@/store/rag.store';
import { useSettingsStore } from '@/store/settings.store';

const WORKSPACE_TABS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'notes', label: 'Notes' },
  { id: 'revision', label: 'Revision' },
  { id: 'analytics', label: 'Analytics' },
];

export function SidebarLayout({
  videoId,
  onReloadTranscript,
}: {
  videoId: string;
  onReloadTranscript?: () => void;
}) {
  const { title, channel, currentTime, duration } = useVideoStore();
  const { activeTab, setActiveTab, utilityPanel, closeUtility } = useUiStore();
  const ragStage = useRagStore((s) => s.stage);
  const ragStatus = useRagStore((s) => s.status);
  const loadAuth = useAuthStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);
  useRagPipeline(videoId);

  useEffect(() => {
    void loadAuth();
    void loadSettings();
  }, [loadAuth, loadSettings]);

  const onJumpToTime = useMemo(
    () => (seconds: number, citeVideoId?: string) => {
      const playlistId = usePlaylistStore.getState().playlist?.playlistId;
      if (citeVideoId && citeVideoId !== videoId) {
        window.location.href = watchUrlFor(citeVideoId, seconds, playlistId ?? undefined);
      } else {
        seekTo(seconds);
      }
    },
    [videoId]
  );

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-neutral-950 text-neutral-100">
      <header className="shrink-0 border-b border-neutral-800 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{title ?? 'Loading video…'}</p>
            {channel && <p className="truncate text-[11px] text-neutral-500">{channel}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <LanguageSelector />
            <button
              type="button"
              onClick={() => setActiveTab('transcript')}
              aria-label="Transcript"
              className="rounded-md p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
            >
              <FileText className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              aria-label="Settings"
              className="rounded-md p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex justify-between font-mono text-[10px] text-neutral-500">
            <span>{formatTime(currentTime)}</span>
            <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-indigo-500 transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {ragStatus === 'building' && ragStage && (
          <p className="mt-2 text-[10px] text-neutral-500" role="status">
            {ragStage}
          </p>
        )}

        <div className="mt-3">
          <Tabs items={WORKSPACE_TABS} value={activeTab} onChange={setActiveTab} />
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {activeTab === 'chat' && <ChatPanel onJumpToTime={onJumpToTime} />}
        {activeTab === 'notes' && <NotesPanel videoId={videoId} />}
        {activeTab === 'revision' && <RevisionPanel videoId={videoId} onJumpToTime={onJumpToTime} />}
        {activeTab === 'analytics' && (
          <AnalyticsPanel videoId={videoId} duration={duration} onJumpToTime={onJumpToTime} />
        )}
      </main>

      {utilityPanel && (
        <div
          className="absolute inset-0 z-20 flex flex-col bg-neutral-950"
          role="dialog"
          aria-label={utilityPanel === 'transcript' ? 'Transcript' : 'Settings'}
        >
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2.5">
            <p className="text-sm font-medium capitalize text-white">{utilityPanel}</p>
            <button
              type="button"
              onClick={closeUtility}
              aria-label="Close panel"
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            {utilityPanel === 'transcript' && (
              <TranscriptPanel onJumpToTime={onJumpToTime} onReload={onReloadTranscript} />
            )}
            {utilityPanel === 'settings' && <SettingsPanel />}
            {utilityPanel === 'export' && <ExportPanel videoId={videoId} />}
          </div>
        </div>
      )}
    </div>
  );
}
