import { useEffect, useRef, useState, memo } from 'react';
import { Send, Trash2 } from 'lucide-react';
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
import type { ChatMode } from '@/features/chat/chat.service';
import { useAiReadiness } from '@/hooks/useAiReadiness';
import type { ChatMessage } from '@/types/ai';
const SUGGESTIONS = [
  'Summarize the main ideas in 3 points',
  'Explain the hardest concept simply',
  'What should I review before an exam?',
];

const MessageBubble = memo(function MessageBubble({
  msg,
  loading,
  onJump,
}: {
  msg: ChatMessage;
  loading: boolean;
  onJump: (seconds: number, videoId?: string) => void;
}) {
  const isUser = msg.role === 'user';

  return (
    <div className={twMerge(clsx('flex', isUser ? 'justify-end' : 'justify-start'))}>
      <div
        className={twMerge(
          clsx(
            'max-w-[92%] rounded-xl px-3.5 py-2.5',
            isUser
              ? 'bg-indigo-600/90 text-white'
              : 'border border-neutral-800 bg-neutral-900/80 text-neutral-100'
          )
        )}
      >
        {isUser ? (
          <p className="text-sm leading-relaxed">{msg.content}</p>
        ) : msg.structured ? (
          <StructuredAnswer
            structured={msg.structured}
            citations={msg.citations}
            sources={msg.sources}
            visibleSections={msg.visibleSections ? new Set(msg.visibleSections) : undefined}
            onJump={onJump}
          />
        ) : loading && !msg.content ? (
          <p className="text-sm text-neutral-500 animate-pulse">Generating answer…</p>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">{msg.content}</p>
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
  const [mode, setMode] = useState<ChatMode>(defaultMode);  const bottomRef = useRef<HTMLDivElement>(null);
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
      subtitle="Hybrid tutor · lecture + general knowledge · structured answers with sources"
      actions={
        <>
          <LanguageBadge />
          <div className="flex rounded-lg border border-neutral-800 p-0.5" role="group" aria-label="Chat mode">            {(['concise', 'deep', 'interview'] as ChatMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={twMerge(
                  clsx(
                    'rounded-md px-2 py-1 text-[10px] font-medium capitalize',
                    mode === m ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300'
                  )
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={clear}
            aria-label="Clear chat"
            className="rounded-md border border-neutral-800 p-1.5 text-neutral-500 hover:text-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {playlist && (
          <div className="mx-4 mt-3 flex gap-1 rounded-lg border border-neutral-800 p-0.5">
            {(['video', 'playlist'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setScope(s);
                  if (s === 'playlist') void usePlaylistStore.getState().refreshPlaylistChunks();
                }}
                className={twMerge(
                  clsx(
                    'flex-1 rounded-md py-1.5 text-[10px] font-medium',
                    scope === s ? 'bg-neutral-800 text-white' : 'text-neutral-500'
                  )
                )}
              >
                {s === 'video' ? 'This video' : `Playlist (${indexedVideoCount})`}
              </button>
            ))}
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
              <p className="text-sm font-medium text-white">Ask about this lecture</p>
              <p className="mt-1 text-xs text-neutral-500">
                Answers are split into summary, explanation, takeaways, and cited sources.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void handleSend(s)}
                    className="rounded-lg border border-neutral-800 px-3 py-2 text-left text-xs text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              loading={loading && msg.role === 'assistant' && !msg.content && !msg.structured}
              onJump={onJumpToTime}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-neutral-800 p-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), void handleSend())}
              placeholder="Ask a question…"
              disabled={loading}
              aria-label="Chat message"
              className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="rounded-lg bg-indigo-600 px-3 py-2.5 text-white hover:bg-indigo-500 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
