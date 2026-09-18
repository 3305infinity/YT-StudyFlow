import type { StructuredChatPayload } from '@/types/chat';
import { CitationGroup } from './CitationGroup';
import { FormattedMarkdownText } from './FormattedMarkdownText';
import type { ChatCitation } from '@/types/ai';
import type { ChatSource } from '@/types/chat';

function sanitizeText(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.values(parsed).flat().filter(Boolean).join(' ');
      }
    } catch {
      // not JSON
    }
  }
  return trimmed
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/\[svg[^\]]*\]/gi, '')
    .replace(/\bsvg\b(?!\s*[:=])/gi, '')
    .replace(/^(welcome!?|hello!?|sure!?|great question!?)[,\s\-]*/i, '')
    .trim();
}

export function StructuredAnswer({
  structured,
  citations,
  sources,
  onJump,
}: {
  structured: StructuredChatPayload;
  citations?: ChatCitation[];
  sources?: ChatSource[];
  visibleSections?: Set<string>;
  onJump: (seconds: number, videoId?: string) => void;
}) {
  const answerContent = sanitizeText(
    structured.explanation || structured.lectureContent || structured.directAnswer || structured.summary || ''
  );

  const showSources = structured.coverage !== 'none' && ((citations && citations.length > 0) || (sources && sources.length > 0));

  return (
    <div className="space-y-4 font-sans text-left text-content">
      {/* Primary Clean Tutor Answer */}
      {answerContent && (
        <div className="leading-relaxed">
          <FormattedMarkdownText
            text={answerContent}
            className="text-[15px] leading-[1.7] text-content"
          />
        </div>
      )}

      {/* Compact Source Chips (only when lecture contributed) */}
      {showSources && (
        <div className="pt-2 border-t border-line/40">
          <CitationGroup citations={citations} sources={sources} onJump={onJump} />
        </div>
      )}
    </div>
  );
}

