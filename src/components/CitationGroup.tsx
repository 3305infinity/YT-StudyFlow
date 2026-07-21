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
    <div className="space-y-2" role="list" aria-label="Sources">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-content-subtle">
        Sources
      </p>
      <div className="grid gap-2">
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
              className="group flex items-start gap-2.5 rounded-lg border border-line bg-surface-overlay px-3 py-2.5 text-left shadow-1 transition-colors duration-170 ease-out hover:border-line-strong hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/45"
            >
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-brand-muted">
                <Clock className="h-3 w-3" aria-hidden />
                {formatTime(c.startTime)}
              </span>
              <span className="min-w-0 flex-1">
                {c.videoTitle && (
                  <span className="block truncate text-[10px] font-medium text-content-muted">
                    {c.videoTitle}
                  </span>
                )}
                <span className="line-clamp-2 text-[11px] leading-[1.5] text-content-muted group-hover:text-content">
                  {c.excerpt}
                </span>
                {score > 0 && (
                  <span className="mt-0.5 block text-[9px] text-content-subtle">
                    Relevance {(score * 100).toFixed(0)}%
                  </span>
                )}
              </span>
              <ExternalLink
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-content-subtle opacity-0 transition-opacity duration-170 ease-out group-hover:opacity-100"
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
