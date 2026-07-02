import type { StructuredChatPayload } from '@/types/chat';
import { CollapsibleSection } from './CollapsibleSection';
import { CitationGroup } from './CitationGroup';
import type { ChatCitation } from '@/types/ai';
import type { ChatSource } from '@/types/chat';
import { MODE_LABELS } from '@/types/chat';

const CONFIDENCE_LABELS = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
} as const;

export function StructuredAnswer({
  structured,
  citations,
  sources,
  visibleSections,
  onJump,
}: {
  structured: StructuredChatPayload;
  citations?: ChatCitation[];
  sources?: ChatSource[];
  visibleSections?: Set<string>;
  onJump: (seconds: number, videoId?: string) => void;
}) {
  const show = (key: string) => !visibleSections || visibleSections.has(key);

  const lectureContent = structured.lectureContent || structured.lectureAnswer || '';
  const additionalExplanation =
    structured.additionalExplanation ||
    (structured.coverage === 'partial' ? structured.generalKnowledge : '');

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-200">
          {MODE_LABELS[structured.mode] ?? structured.mode}
        </span>
        {structured.confidence > 0 && (
          <span className="text-[10px] text-neutral-500">
            {CONFIDENCE_LABELS[structured.confidenceLabel]} ·{' '}
            {(structured.confidence * 100).toFixed(0)}% match
          </span>
        )}
      </div>

      {show('summary') && structured.summary && (
        <CollapsibleSection title="Summary" defaultOpen>
          <p className="text-sm leading-relaxed text-neutral-200">{structured.summary}</p>
        </CollapsibleSection>
      )}

      {show('lectureContent') && lectureContent && (
        <CollapsibleSection
          title={
            structured.mode === 'general-knowledge' ? 'Lecture coverage' : 'From this lecture'
          }
          defaultOpen
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
            {lectureContent}
          </p>
        </CollapsibleSection>
      )}

      {show('additionalExplanation') && additionalExplanation && structured.mode === 'hybrid' && (
        <CollapsibleSection title="Additional explanation" defaultOpen>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
            {additionalExplanation}
          </p>
        </CollapsibleSection>
      )}

      {show('generalKnowledge') &&
        structured.generalKnowledge &&
        structured.mode === 'general-knowledge' && (
          <CollapsibleSection title="General knowledge" defaultOpen>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
              {structured.generalKnowledge}
            </p>
          </CollapsibleSection>
        )}

      {show('keyTakeaways') && structured.keyTakeaways.length > 0 && (
        <CollapsibleSection title="Key takeaways" badge={String(structured.keyTakeaways.length)}>
          <ul className="space-y-1.5">
            {structured.keyTakeaways.map((point) => (
              <li key={point} className="flex gap-2 text-sm text-neutral-300">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
                {point}
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      {show('lectureRelatedTopics') && structured.lectureRelatedTopics.length > 0 && (
        <CollapsibleSection title="Related lecture topics" defaultOpen={false}>
          <div className="flex flex-wrap gap-1.5">
            {structured.lectureRelatedTopics.map((topic) => (
              <span
                key={topic}
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100"
              >
                {topic}
              </span>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {show('suggestedRelatedTopics') && structured.suggestedRelatedTopics.length > 0 && (
        <CollapsibleSection title="Suggested related topics" defaultOpen={false}>
          <p className="mb-2 text-[11px] text-neutral-500">
            These topics were not found in the lecture — explore them separately.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {structured.suggestedRelatedTopics.map((topic) => (
              <span
                key={topic}
                className="rounded-md border border-neutral-700 bg-neutral-800/80 px-2 py-1 text-xs text-neutral-300"
              >
                {topic}
              </span>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {show('sources') && (citations?.length || sources?.length) ? (
        <CollapsibleSection title="Sources" defaultOpen>
          <CitationGroup citations={citations} sources={sources} onJump={onJump} />
        </CollapsibleSection>
      ) : null}
    </div>
  );
}
