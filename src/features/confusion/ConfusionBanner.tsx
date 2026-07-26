import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Brain, Pause, Rewind, TrendingUp } from 'lucide-react';
import { STUDYFLOW_EVENTS } from '@lib/constants';
import type { ConfusionZone, HeatmapBucket } from '@/types/ai';
import { formatTime } from '@lib/youtube';
import {
  computeSessionStats,
  getBucketEventStats,
  type LearningEvent,
} from '@/features/heatmap/density';
import { getTrackerEvents } from './confusionTracker';
import { WorkspaceShell } from '@/components/WorkspaceShell';
import { useAnalyticsStore } from '@/store/analytics.store';
import { useRevisionStore } from '@/features/revision/revision.store';
import { useVideoStore } from '@store/video.store';

export function AnalyticsPanel({
  videoId,
  onJumpToTime,
}: {
  videoId: string;
  onJumpToTime: (seconds: number) => void;
}) {
  const [zones, setZones] = useState<ConfusionZone[]>([]);
  const [buckets, setBuckets] = useState<HeatmapBucket[]>([]);
  const [events, setEvents] = useState<LearningEvent[]>([]);
  const [hoverBucket, setHoverBucket] = useState<HeatmapBucket | null>(null);
  const quizAccuracy = useAnalyticsStore((s) => s.quizAccuracy);
  const flashcardsReviewed = useAnalyticsStore((s) => s.flashcardsReviewed);
  const analyticsDuration = useAnalyticsStore((s) => s.duration);
  const fcStats = useRevisionStore((s) => s.getFlashcardStats());

  useEffect(() => {
    const onHeatmap = (e: Event) => {
      const d = (e as CustomEvent).detail as {
        videoId: string;
        buckets: HeatmapBucket[];
        zones: ConfusionZone[];
      };
      if (d.videoId !== videoId) return;
      setBuckets(d.buckets);
      setZones(d.zones);
      useAnalyticsStore.getState().setSession({
        videoId,
        buckets: d.buckets,
        zones: d.zones,
        duration: analyticsDuration,
      });
    };
    const onConfusion = (e: Event) => {
      const d = (e as CustomEvent).detail as { videoId: string; events: LearningEvent[] };
      if (d.videoId !== videoId) return;
      setEvents(d.events ?? []);
      useAnalyticsStore.getState().setSession({ videoId, events: d.events, duration: analyticsDuration });
    };

    const initial = getTrackerEvents();
    setEvents(initial);
    const currentDuration = useVideoStore.getState().duration;
    useAnalyticsStore.getState().setSession({ videoId, events: initial, duration: currentDuration });

    window.addEventListener(STUDYFLOW_EVENTS.HEATMAP_UPDATE, onHeatmap);
    window.addEventListener(STUDYFLOW_EVENTS.CONFUSION_UPDATE, onConfusion);
    return () => {
      window.removeEventListener(STUDYFLOW_EVENTS.HEATMAP_UPDATE, onHeatmap);
      window.removeEventListener(STUDYFLOW_EVENTS.CONFUSION_UPDATE, onConfusion);
    };
  }, [videoId, analyticsDuration]);

  const stats = useMemo(() => computeSessionStats(events, analyticsDuration), [events, analyticsDuration]);

  const hoverStats = useMemo(() => {
    if (!hoverBucket) return null;
    return getBucketEventStats(events, hoverBucket.startTime, hoverBucket.endTime);
  }, [hoverBucket, events]);

  const studyMinutes = Math.round((stats.watchPercentEstimate / 100) * (analyticsDuration / 60));

  return (
    <WorkspaceShell title="Analytics" subtitle="Study signals from this session">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
        <section className="grid grid-cols-2 gap-2">
          <MetricCard label="Study time" value={`${studyMinutes}m`} sub="Estimated this session" />
          <MetricCard
            label="Quiz accuracy"
            value={quizAccuracy != null ? `${Math.round(quizAccuracy * 100)}%` : '—'}
            sub="From revision tab"
          />
          <MetricCard label="Cards reviewed" value={String(flashcardsReviewed || fcStats.reviewed)} sub="SM-2 deck" />
          <MetricCard label="Due today" value={String(fcStats.dueToday)} sub="Flashcards" />
        </section>

        <section className="grid grid-cols-2 gap-2">
          <StatCard icon={Rewind} label="Rewinds" value={stats.rewinds} />
          <StatCard icon={Pause} label="Long pauses" value={stats.longPauses} />
          <StatCard icon={TrendingUp} label="Seeks" value={stats.seeks} />
          <StatCard icon={BarChart3} label="Events" value={stats.totalEvents} />
        </section>

        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Confusion heatmap
          </h3>
          <div className="relative mt-2">
            <div className="flex h-12 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
              {(buckets.length ? buckets : [{ startTime: 0, endTime: 1, density: 0 }]).map((b) => (
                <button
                  key={b.startTime}
                  type="button"
                  className="h-full min-w-[3px] flex-1 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                  style={{ background: `rgba(239,68,68,${0.06 + b.density * 0.9})` }}
                  onMouseEnter={() => setHoverBucket(b)}
                  onMouseLeave={() => setHoverBucket(null)}
                  onClick={() => onJumpToTime(b.startTime)}
                  aria-label={`Jump to ${formatTime(b.startTime)}`}
                />
              ))}
            </div>

            {hoverBucket && hoverStats && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-[11px] shadow-lg">
                <p className="font-medium text-white">
                  {formatTime(hoverBucket.startTime)} – {formatTime(hoverBucket.endTime)}
                </p>
                <p className="mt-1 text-neutral-400">
                  Confusion {(hoverStats.confusionScore * 100).toFixed(0)}% · Rewinds {hoverStats.rewinds} ·
                  Pauses {hoverStats.pauses + hoverStats.longPauses} · Seeks {hoverStats.seeks}
                </p>
              </div>
            )}

            {analyticsDuration > 0 && (
              <div className="mt-1 flex justify-between font-mono text-[10px] text-neutral-600">
                <span>0:00</span>
                <span>{formatTime(analyticsDuration)}</span>
              </div>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            Weak topics
          </h3>
          {zones.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">
              Rewind or pause on difficult sections — they will appear here.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {zones.map((z) => (
                <button
                  key={`${z.startTime}-${z.endTime}`}
                  type="button"
                  onClick={() => onJumpToTime(z.startTime)}
                  className="flex w-full items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-left hover:bg-amber-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-white">
                      {formatTime(z.startTime)} – {formatTime(z.endTime)}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-400">{z.reasons.join(' · ')}</p>
                    <p className="text-[10px] text-amber-200/70">
                      Difficulty {(z.score * 100).toFixed(0)}%
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {stats.mostReplayedTime != null && (
          <button
            type="button"
            onClick={() => onJumpToTime(stats.mostReplayedTime!)}
            className="flex w-full items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2.5 text-left text-xs text-neutral-400 hover:border-neutral-700"
          >
            <Brain className="h-4 w-4 text-indigo-400" />
            Most replayed: {formatTime(stats.mostReplayedTime)}
          </button>
        )}
      </div>
    </WorkspaceShell>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
      <p className="text-[10px] text-neutral-600">{sub}</p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Rewind;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-neutral-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
