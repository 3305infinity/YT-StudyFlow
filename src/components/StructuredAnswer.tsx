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

/** Shared paragraph typography for answer bodies. */
const ANSWER_P = 'whitespace-pre-wrap text-body leading-[1.7] text-content-muted';

function sanitizeText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.values(parsed).flat().filter(Boolean).join(' ');
      }
    } catch {
      // not valid JSON, return as-is
    }
  }
  return trimmed;
}

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

  const lectureContent = sanitizeText(structured.lectureContent || structured.lectureAnswer || '');
  const additionalExplanation = sanitizeText(
    structured.additionalExplanation ||
      (structured.coverage === 'partial' ? structured.generalKnowledge : '')
  );

  const isLowConfidence = structured.confidenceLabel === 'low' && structured.confidence < 0.5;

  return (
    <div className="space-y-3 font-sans">
      {isLowConfidence && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-caption text-warning">
          Low confidence ({Math.round(structured.confidence * 100)}% match). Answer may be incomplete or
          inaccurate. Verify with the sources below.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-brand/30 bg-brand/[0.10] px-2 py-0.5 text-[10px] font-medium text-brand-muted">
          {MODE_LABELS[structured.mode] ?? structured.mode}
        </span>
        {structured.confidence > 0 && (
          <span className="text-[10px] text-content-subtle">
            {CONFIDENCE_LABELS[structured.confidenceLabel]} ·{' '}
            {(structured.confidence * 100).toFixed(0)}% match
          </span>
        )}
      </div>

      {show('summary') && structured.summary && (
        <CollapsibleSection title="Summary" defaultOpen>
          <p className={ANSWER_P}>{sanitizeText(structured.summary)}</p>
        </CollapsibleSection>
      )}

      {show('lectureContent') && lectureContent && (
        <CollapsibleSection
          title={
            structured.mode === 'general-knowledge' ? 'Lecture coverage' : 'From this lecture'
          }
          defaultOpen
        >
          <p className={ANSWER_P}>{lectureContent}</p>
        </CollapsibleSection>
      )}

      {show('additionalExplanation') && additionalExplanation && structured.mode === 'hybrid' && (
        <CollapsibleSection title="Additional explanation" defaultOpen>
          <p className={ANSWER_P}>{additionalExplanation}</p>
        </CollapsibleSection>
      )}

      {show('generalKnowledge') &&
        structured.generalKnowledge &&
        structured.mode === 'general-knowledge' && (
          <CollapsibleSection title="General knowledge" defaultOpen>
            {/* Supplementary info: intentionally lighter than lecture content. */}
            <p className="whitespace-pre-wrap text-body leading-[1.7] text-content-subtle">
              {sanitizeText(structured.generalKnowledge)}
            </p>
          </CollapsibleSection>
        )}

      {show('keyTakeaways') && structured.keyTakeaways.length > 0 && (
        <CollapsibleSection title="Key takeaways" badge={String(structured.keyTakeaways.length)}>
          <ul className="space-y-2.5">
            {structured.keyTakeaways.map((point) => (
              <li key={point} className="flex gap-2.5 text-body text-content-muted">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand/70" />
                {sanitizeText(point)}
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
                className="rounded-md border border-brand/25 bg-brand/[0.08] px-2 py-1 text-caption text-brand-muted transition-colors duration-170 ease-out hover:border-brand/40 hover:bg-brand/[0.14]"
              >
                {topic}
              </span>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {show('suggestedRelatedTopics') && structured.suggestedRelatedTopics.length > 0 && (
        <CollapsibleSection title="Suggested related topics" defaultOpen={false}>
          <p className="mb-2.5 text-[11px] text-content-subtle">
            These topics were not found in the lecture — explore them separately.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {structured.suggestedRelatedTopics.map((topic) => (
              <span
                key={topic}
                className="rounded-md border border-line bg-surface-overlay px-2 py-1 text-caption text-content-muted transition-colors duration-170 ease-out hover:border-line-strong hover:text-content"
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
