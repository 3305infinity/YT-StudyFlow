import { usePipelineStore } from '@/store/pipeline.store';
import { useChatStore } from '@/features/chat/chat.store';
import type { PipelineStage } from '@/types/chat';

const STAGES: PipelineStage[] = [
  'searching-knowledge',
  'generating-response',
  'rendering-citations',
];

export function PipelineProgress() {
  const { stage, message } = usePipelineStore();
  const loading = useChatStore((s) => s.loading);

  if (!loading || stage === 'idle' || stage === 'complete' || stage === 'error') {
    return null;
  }

  const activeIndex = STAGES.indexOf(stage);

  return (
    <div
      className="mx-4 mb-2 rounded-lg border border-line bg-surface-overlay px-3 py-2.5"
      role="status"
      aria-live="polite"
    >
      <p className="text-xs font-medium text-content animate-pulse">{message}</p>
      <div className="mt-2 flex gap-1">
        {STAGES.map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              activeIndex >= i ? 'bg-brand' : 'bg-surface-raised'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
