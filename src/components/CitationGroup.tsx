import { Clock, ExternalLink } from 'lucide-react';
import type { ChatCitation } from '@/types/ai';
import type { ChatSource } from '@/types/chat';
import { formatTime } from '@lib/youtube';

type CitationItem = ChatCitation | ChatSource;

function isCitation(c: CitationItem): c is ChatCitation {
  return 'id' in c;
}

export function CitationGroup({
  citations,
  sources,
  onJump,
}: {
  citations?: ChatCitation[];
  sources?: ChatSource[];
  onJump: (seconds: number, videoId?: string) => void;
}) {
  const items: CitationItem[] =
    citations?.length ? citations : sources ?? [];

  if (!items.length) return null;

  return (
    <div className="space-y-1.5" role="list" aria-label="Sources">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        Sources
      </p>
      <div className="grid gap-1.5">
        {items.map((c) => {
          const key = isCitation(c) ? c.id : c.chunkId;
          const score = isCitation(c) ? c.similarityScore : c.similarityScore;
          return (
            <button
              key={key}
              type="button"
              role="listitem"
              onClick={() => onJump(c.startTime, c.videoId)}
              title={c.excerpt}
              className="group flex items-start gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-2 text-left transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
            >
              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-indigo-500/15 px-1.5 py-0.5 font-mono text-[10px] text-indigo-200">
                <Clock className="h-3 w-3" aria-hidden />
                {formatTime(c.startTime)}
              </span>
              <span className="min-w-0 flex-1">
                {c.videoTitle && (
                  <span className="block truncate text-[10px] font-medium text-neutral-400">
                    {c.videoTitle}
                  </span>
                )}
                <span className="line-clamp-2 text-[11px] leading-4 text-neutral-400 group-hover:text-neutral-200">
                  {c.excerpt}
                </span>
                {score > 0 && (
                  <span className="mt-0.5 block text-[9px] text-neutral-600">
                    Relevance {(score * 100).toFixed(0)}%
                  </span>
                )}
              </span>
              <ExternalLink
                className="mt-0.5 h-3 w-3 shrink-0 text-neutral-600 opacity-0 group-hover:opacity-100"
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
