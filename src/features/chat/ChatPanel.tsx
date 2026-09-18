import { useEffect, useRef, useState, memo } from 'react';
import { Send, Trash2, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useChat } from '@/hooks/useChat';
import { useSettingsStore } from '@/store/settings.store';
import { usePlaylistStore } from '@/store/playlist.store';
import { FeatureGate } from '@/components/FeatureGate';
import { WorkspaceShell } from '@/components/WorkspaceShell';
import { StructuredAnswer } from '@/components/StructuredAnswer';
import { LanguageBadge } from '@/components/LanguageSelector';
import { PipelineProgress } from '@/components/PipelineProgress';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Button } from '@/components/Button';
import { Loader } from '@/components/Loader';
import type { ChatMode } from '@/features/chat/chat.service';
import { useAiReadiness } from '@/hooks/useAiReadiness';
import type { ChatMessage } from '@/types/ai';

const SUGGESTIONS = [
  'Summarize the main ideas in 3 points',
  'Explain the hardest concept simply',
  'What should I review before an exam?',
];

const CHAT_MODES: ChatMode[] = ['concise', 'deep', 'interview'];

const MessageBubble = memo(function MessageBubble({
  msg,
  loading,
  onJump,
  grouped,
}: {
  msg: ChatMessage;
  loading: boolean;
  onJump: (seconds: number, videoId?: string) => void;
  /** True when the previous message is from the same sender (tighter spacing). */
  grouped: boolean;
}) {
  const isUser = msg.role === 'user';

  return (
    <div
      className={twMerge(
        clsx(
          'flex',
          isUser ? 'justify-end' : 'justify-start',
          // Conversation rhythm: grouped same-sender messages sit tight; a sender
          // switch gets a larger gap for clear separation.
          grouped ? 'mt-1.5' : 'mt-5'
        )
      )}
    >
      <div
        className={twMerge(
          clsx(
            'min-w-0 rounded-lg px-4 py-3',
            isUser
              ? 'max-w-[78%] bg-surface-overlay text-content shadow-1'
              : 'w-full max-w-[92%] border border-line bg-surface text-content',
            // Round only one corner on grouped messages for a connected look.
            !grouped && (isUser ? 'rounded-br-sm' : 'rounded-bl-sm')
          )
        )}
      >
        {isUser ? (
          <p className="text-[15px] font-medium leading-relaxed">{msg.content}</p>
        ) : msg.structured ? (
          <StructuredAnswer
            structured={msg.structured}
            citations={msg.citations}
            sources={msg.sources}
            visibleSections={msg.visibleSections ? new Set(msg.visibleSections) : undefined}
            onJump={onJump}
          />
        ) : loading && !msg.content ? (
          <div className="flex items-center gap-2 py-0.5 text-xs text-content-subtle">
            <Loader />
            <span>Generating answer…</span>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-[15px] leading-[1.7] text-content-muted">
            {msg.content}
          </p>
        )}
      </div>
    </div>
  );
});

export function ChatPanel({
  onJumpToTime,
}: {
  onJumpToTime: (seconds: number, citeVideoId?: string) => void;
}) {
  const [input, setInput] = useState('');
  const defaultMode = useSettingsStore((s) => s.chatMode);
  const [mode, setMode] = useState<ChatMode>(defaultMode);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, loading, error, send, clear } = useChat();
  const readiness = useAiReadiness();
  const playlist = usePlaylistStore((s) => s.playlist);
  const scope = usePlaylistStore((s) => s.scope);
  const setScope = usePlaylistStore((s) => s.setScope);
  const indexedVideoCount = usePlaylistStore((s) => s.indexedVideoCount);

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    try {
      await send(q, mode);
    } catch {
      // error surfaced via store
    }
  };

  if (readiness.state !== 'ready') {
    return <FeatureGate>{null}</FeatureGate>;
  }

  return (
    <WorkspaceShell
      title="AI Chat"
      subtitle="Ask anything about this lecture — structured answers with sources"
      actions={
        <>
          <LanguageBadge />
          <div className="ds-segment" role="group" aria-label="Chat mode">
            {CHAT_MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className="ds-segment-item capitalize"
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={clear}
            aria-label="Clear chat"
            className="ds-icon-btn"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {playlist && (
          <div className="mx-4 mt-3 flex">
            <div className="ds-segment flex-1" role="group" aria-label="Chat scope">
              {(['video', 'playlist'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setScope(s);
                    if (s === 'playlist') void usePlaylistStore.getState().refreshPlaylistChunks();
                  }}
                  aria-pressed={scope === s}
                  className="ds-segment-item flex-1"
                >
                  {s === 'video' ? 'This video' : `Playlist (${indexedVideoCount})`}
                </button>
              ))}
            </div>
          </div>
        )}

        <PipelineProgress />

        {error && !loading && (
          <ErrorBanner
            message={error}
            actions={[
              {
                label: 'Retry last question',
                onClick: () => {
                  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                  if (lastUser) void handleSend(lastUser.content);
                },
              },
            ]}
          />
        )}

        <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 py-4 pb-5">
          {messages.length === 0 && (
            <div className="ds-card flex flex-col items-center px-6 py-8 text-center">
              <span
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-brand-gradient shadow-cta"
                aria-hidden
              >
                <Sparkles className="h-5 w-5 text-white" />
              </span>
              <h2 className="text-heading text-content">Ask about this lecture</h2>
              <p className="mt-1.5 max-w-[34ch] text-caption text-content-subtle">
                Get structured answers — summary, explanation, takeaways, and cited sources from the video.
              </p>
              <div className="mt-5 flex w-full flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void handleSend(s)}
                    className="rounded-lg border border-line bg-surface px-3 py-2.5 text-left text-caption text-content-muted transition-colors duration-170 ease-out hover:border-line-strong hover:bg-surface-overlay hover:text-content focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/45"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const prev = messages[i - 1];
            const grouped = Boolean(prev) && prev!.role === msg.role;
            return (
              <MessageBubble
                key={msg.id}
                msg={msg}
                loading={loading && msg.role === 'assistant' && !msg.content && !msg.structured}
                onJump={onJumpToTime}
                grouped={grouped}
              />
            );
          })}
          <div ref={bottomRef} className={messages.length ? 'h-2' : undefined} />
        </div>

        <div className="shrink-0 border-t border-line p-3">
          <div className="flex items-end gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), void handleSend())}
              placeholder="Ask a question…"
              disabled={loading}
              aria-label="Chat message"
              className="ds-input flex-1"
            />
            <Button
              type="button"
              variant="primary"
              size="md"
              aria-label="Send message"
              disabled={loading || !input.trim()}
              onClick={() => void handleSend()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
