import { memo } from 'react';
import { formatTime } from '@lib/youtube';
import { useVideoStore } from '@store/video.store';

function ProgressBar() {
  const currentTime = useVideoStore((s) => s.currentTime);
  const duration = useVideoStore((s) => s.duration);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div>
      <div className="mb-1.5 flex justify-between font-mono text-[10px] text-content-subtle">
        <span>{formatTime(currentTime)}</span>
        <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-overlay">
        <div
          className="h-full rounded-full bg-brand-gradient transition-[width] duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export const MemoizedProgressBar = memo(ProgressBar);
