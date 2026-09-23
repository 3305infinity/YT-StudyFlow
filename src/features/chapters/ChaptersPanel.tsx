import { useEffect, useState } from 'react';
import { BookOpen, ListTree, Play, Sparkles } from 'lucide-react';
import { generateChaptersForVideo, loadChapters } from './chapterGenerator';
import { useRagStore } from '@/store/rag.store';
import { useVideoStore } from '@/store/video.store';
import type { Chapter } from '@/types/ai';
import { formatTime } from '@lib/youtube';
import { Loader } from '@/components/Loader';
import { FeatureGate } from '@/components/FeatureGate';
import { useAiReadiness } from '@/hooks/useAiReadiness';

export function ChaptersPanel({
  videoId,
  onJumpToTime,
}: {
  videoId: string;
  onJumpToTime: (seconds: number) => void;
}) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chunks = useRagStore((s) => s.chunks);
  const title = useVideoStore((s) => s.title);
  const readiness = useAiReadiness();

  useEffect(() => {
    void loadChapters(videoId).then(setChapters);
  }, [videoId]);

  const generate = async () => {
    if (!chunks.length) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateChaptersForVideo({
        videoId,
        semanticChunks: chunks,
        videoTitle: title ?? undefined,
      });
      setChapters(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  if (readiness.state !== 'ready') {
    return <FeatureGate>{null}</FeatureGate>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-base text-content">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <ListTree className="h-4 w-4 text-brand" />
          <div>
            <p className="text-sm font-semibold text-content">Chapters</p>
            <p className="text-[11px] text-content-subtle">AI-generated lecture structure</p>
          </div>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={generate}
          className="flex items-center gap-1.5 rounded-xl bg-brand-gradient shadow-cta px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {chapters.length ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {loading && (
        <div className="border-b border-line p-4">
          <Loader label="Analyzing lecture structure…" />
        </div>
      )}
      {error && <p className="border-b border-line px-4 py-2 text-xs text-danger">{error}</p>}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {chapters.length > 0 ? (
          <div className="relative space-y-0">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-line" />

            {chapters.map((ch, i) => (
              <div key={ch.id} className="relative pl-8 pb-5">
                <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-brand/40 bg-surface text-[10px] font-bold text-brand">
                  {i + 1}
                </div>

                <div className="rounded-2xl border border-line bg-surface-raised p-3.5 transition-colors hover:border-line-strong hover:bg-surface-overlay">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-content">{ch.title}</h4>
                      <p className="mt-1 font-mono text-[10px] font-semibold text-brand">
                        {formatTime(ch.startTime)} – {formatTime(ch.endTime)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onJumpToTime(ch.startTime)}
                      className="shrink-0 rounded-lg bg-brand/15 p-2 text-brand hover:bg-brand/25"
                      title="Jump to chapter"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p className="mt-2.5 text-[13px] leading-6 text-content-muted">{ch.summary}</p>

                  {ch.keyPoints.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {ch.keyPoints.slice(0, 5).map((p) => (
                        <li key={p} className="flex gap-2 text-xs text-content-subtle">
                          <BookOpen className="mt-0.5 h-3 w-3 shrink-0 text-brand" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ListTree className="h-10 w-10 text-brand" />
              <p className="mt-3 text-sm font-bold text-content">No chapters yet</p>
              <p className="mt-1 max-w-[220px] text-xs text-content-subtle">
                Generate semantic chapters to navigate this lecture by topic.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
