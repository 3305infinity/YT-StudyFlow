import { Clock } from 'lucide-react';
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
  const items: CitationItem[] = citations?.length ? citations : sources ?? [];

  if (!items.length) return null;

  // Deduplicate items by timestamp
  const uniqueItems = items.filter((item, idx, self) => 
    idx === self.findIndex((t) => Math.abs(t.startTime - item.startTime) < 5)
  ).slice(0, 4);

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1" role="list" aria-label="Sources">
      <span className="text-[12px] font-medium text-content-subtle mr-1">Sources:</span>
      {uniqueItems.map((c) => {
        const key = isCitation(c) ? c.id : c.chunkId;
        return (
          <button
            key={key}
            type="button"
            role="listitem"
            onClick={() => onJump(c.startTime, c.videoId)}
            title={c.excerpt || 'Seek to video lecture timestamp'}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-brand/[0.06] px-2.5 py-1 text-[12px] font-medium text-brand-muted transition-all duration-170 hover:border-brand/50 hover:bg-brand/[0.12] hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/45"
          >
            <Clock className="h-3 w-3 shrink-0 text-brand" aria-hidden />
            <span>Lecture · {formatTime(c.startTime)}</span>
          </button>
        );
      })}
    </div>
  );
}

