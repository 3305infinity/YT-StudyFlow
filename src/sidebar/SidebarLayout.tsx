import { useMemo, useEffect, useState, memo } from 'react';
import { FileText, Settings, X, GraduationCap, Sun, Moon } from 'lucide-react';
import { clsx } from 'clsx';

import { TranscriptPanel } from '@/features/transcript/TranscriptPanel';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { NotesPanel } from '@/features/notes/NotesPanel';
import { RevisionPanel } from '@/features/revision/RevisionPanel';
import { AnalyticsPanel } from '@/features/confusion/ConfusionBanner';
import { ExportPanel } from '@/features/export/ExportPanel';
import { SettingsPanel } from '@/pages/Settings';
import { Tabs } from '@/components/Tabs';
import { LanguageSelector } from '@/components/LanguageSelector';
import { seekTo } from '@lib/youtube';
import { watchUrlFor } from '@lib/playlist';
import { usePlaylistStore } from '@/store/playlist.store';
import { useVideoStore } from '@store/video.store';
import { useUiStore, type SidebarTab } from '@store/ui.store';
import { useRagPipeline } from '@/hooks/useRagPipeline';
import { useAuthStore } from '@store/auth.store';
import { useRagStore } from '@store/rag.store';
import { useSettingsStore } from '@store/settings.store';
import { collapseSidebar, expandSidebar } from '@/content/injectSidebar';
import { MemoizedProgressBar } from './ProgressBar';

const WORKSPACE_TABS: Array<{ id: SidebarTab; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'notes', label: 'Notes' },
  { id: 'revision', label: 'Revision' },
  { id: 'analytics', label: 'Analytics' },
];

const MemoizedChatPanel = memo(ChatPanel);
const MemoizedNotesPanel = memo(NotesPanel);
const MemoizedRevisionPanel = memo(RevisionPanel);
const MemoizedAnalyticsPanel = memo(AnalyticsPanel);
const MemoizedTranscriptPanel = memo(TranscriptPanel);
const MemoizedSettingsPanel = memo(SettingsPanel);
const MemoizedExportPanel = memo(ExportPanel);

export function SidebarLayout({
  videoId,
  onReloadTranscript,
}: {
  videoId: string;
  onReloadTranscript?: () => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const title = useVideoStore((s) => s.title);
  const channel = useVideoStore((s) => s.channel);
  const { activeTab, setActiveTab, utilityPanel, closeUtility } = useUiStore();
  const ragStage = useRagStore((s) => s.stage);
  const ragStatus = useRagStore((s) => s.status);
  const loadAuth = useAuthStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);
  const theme = useSettingsStore((s) => s.theme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  useRagPipeline(videoId);

  useEffect(() => {
    void loadAuth();
    void loadSettings();
  }, [loadAuth, loadSettings]);

  const toggleDrawer = () => {
    if (isCollapsed) {
      expandSidebar();
      setIsCollapsed(false);
    } else {
      collapseSidebar();
      setIsCollapsed(true);
    }
  };

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

  const stableOnReloadTranscript = useMemo(
    () => onReloadTranscript ?? (() => {}),
    [onReloadTranscript]
  );

  const isUtility = Boolean(utilityPanel);

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={toggleDrawer}
        title="Open YT StudyFlow"
        aria-label="Open YT StudyFlow"
        className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-brand-gradient text-white shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer border-none"
        style={{
          boxShadow: '0 0 20px rgba(168, 85, 247, 0.6), 0 4px 14px rgba(0, 0, 0, 0.6)',
        }}
      >
        <GraduationCap className="h-6 w-6 text-white transition-transform duration-300 group-hover:rotate-12" />
        <span className="absolute -inset-1 rounded-full bg-brand-gradient opacity-30 blur-md transition-opacity group-hover:opacity-75" />
      </button>
    );
  }

  return (
    <div
      data-theme={theme}
      className={clsx(
        'relative flex h-full flex-col overflow-hidden bg-base text-content shadow-2xl transition-colors duration-200',
        theme === 'light' && 'light'
      )}
    >
      {/* ---------- Brand bar ---------- */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-4 pb-3 bg-surface/30 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-gradient shadow-cta transition-transform hover:scale-105"
            aria-hidden
          >
            <GraduationCap className="h-4 w-4 text-white" />
          </span>
          <span className="truncate text-[15px] font-semibold tracking-tight text-content">
            YT <span className="text-gradient font-bold">StudyFlow</span>
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void toggleTheme()}
            aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            className="ds-icon-btn group relative"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400 transition-transform duration-200 group-hover:scale-110" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-600 transition-transform duration-200 group-hover:scale-110" />
            )}
          </button>
          <LanguageSelector />
          <button
            type="button"
            onClick={toggleDrawer}
            aria-label="Collapse sidebar"
            title="Collapse sidebar to menu icon"
            className="ds-icon-btn group relative hover:bg-surface-overlay hover:text-white"
          >
            <X className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90 group-hover:scale-110" />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transcript')}
            aria-label="Open transcript"
            className="ds-icon-btn"
          >
            <FileText className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            aria-label="Open settings"
            className="ds-icon-btn"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ---------- Now playing ---------- */}
      <div className="shrink-0 px-4 pb-3">
        <p className="truncate text-body font-medium text-content">
          {title ?? 'Loading video…'}
        </p>
        {channel && (
          <p className="mt-0.5 truncate text-caption text-content-subtle">{channel}</p>
        )}

        <div className="mt-3">
          <MemoizedProgressBar />
        </div>

        {ragStatus === 'building' && ragStage && (
          <p className="mt-2 text-[10px] text-content-subtle" role="status">
            {ragStage}
          </p>
        )}
      </div>

      {/* ---------- Tab bar ---------- */}
      <div className="shrink-0 px-4 pb-3">
        <Tabs items={WORKSPACE_TABS} value={activeTab} onChange={(tab) => setActiveTab(tab as SidebarTab)} />
      </div>

      <div className="h-px shrink-0 bg-line" />

      {/* ---------- Active panel ---------- */}
      <main className="min-h-0 flex-1 flex flex-col overflow-hidden">
        {activeTab === 'chat' && <MemoizedChatPanel onJumpToTime={onJumpToTime} />}
        {activeTab === 'transcript' && (
          <MemoizedTranscriptPanel onJumpToTime={onJumpToTime} onReload={stableOnReloadTranscript} />
        )}
        {activeTab === 'notes' && <MemoizedNotesPanel videoId={videoId} />}
        {activeTab === 'revision' && (
          <MemoizedRevisionPanel videoId={videoId} onJumpToTime={onJumpToTime} />
        )}
        {activeTab === 'analytics' && (
          <MemoizedAnalyticsPanel videoId={videoId} onJumpToTime={onJumpToTime} />
        )}
      </main>

      {/* ---------- Utility overlay (Transcript / Settings / Export) ---------- */}
      {isUtility && (
        <div
          className="absolute inset-0 z-20 flex flex-col bg-base"
          role="dialog"
          aria-modal="true"
          aria-label={
            utilityPanel === 'transcript'
              ? 'Transcript'
              : utilityPanel === 'settings'
                ? 'Settings'
                : 'Export'
          }
        >
          <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
            <p className="text-body font-medium capitalize text-content">{utilityPanel}</p>
            <button
              type="button"
              onClick={closeUtility}
              aria-label="Close panel"
              className="ds-icon-btn"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            {utilityPanel === 'transcript' && (
              <MemoizedTranscriptPanel onJumpToTime={onJumpToTime} onReload={stableOnReloadTranscript} />
            )}
            {utilityPanel === 'settings' && <MemoizedSettingsPanel />}
            {utilityPanel === 'export' && <MemoizedExportPanel videoId={videoId} />}
          </div>
        </div>
      )}

      {/* ---------- Footer ---------- */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-gradient"
            aria-hidden
          >
            <GraduationCap className="h-3 w-3 text-white" />
          </span>
          <span className="truncate text-[11px] font-medium text-content-muted">
            YT StudyFlow
          </span>
          <span className="rounded-full border border-line px-1.5 py-0.5 text-[10px] text-content-subtle">
            v1.0
          </span>
        </div>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          aria-label="Open profile and settings"
          className="ds-icon-btn"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
