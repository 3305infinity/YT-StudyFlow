import type { CoverageCase } from './coverage.js';

/** Response mode derived from retrieval quality. */
export type ResponseMode = 'lecture-grounded' | 'hybrid' | 'general-knowledge';

export function coverageToMode(coverage: CoverageCase): ResponseMode {
  switch (coverage) {
    case 'strong':
      return 'lecture-grounded';
    case 'partial':
      return 'hybrid';
    case 'none':
    default:
      return 'general-knowledge';
  }
}

export const MODE_LABELS: Record<ResponseMode, string> = {
  'lecture-grounded': 'Lecture grounded',
  hybrid: 'Hybrid explanation',
  'general-knowledge': 'General knowledge',
};

export function modeInstructions(mode: ResponseMode): string {
  switch (mode) {
    case 'lecture-grounded':
      return [
        'MODE A - LECTURE GROUNDED: the retrieved transcript strongly covers this topic.',
        'lectureContent: synthesize the transcript into a clear teacher-style answer with timestamp references when useful.',
        'additionalExplanation: empty unless the student explicitly asks for background.',
        'Do not copy transcript sentences verbatim. Do not invent lecture quotes.',
      ].join(' ');
    case 'hybrid':
      return [
        'MODE B - HYBRID EXPLANATION: the retrieved transcript may only partially cover this topic.',
        'Use the retrieved chunks as the anchor, then add missing context that helps the student understand.',
        'lectureContent: explain the most relevant transcript-backed ideas naturally, with timestamp references when useful.',
        'additionalExplanation: fill gaps, simplify hard ideas, and connect concepts without pretending the extra context came from the lecture.',
        'Do not refuse just because similarity is low if relevant transcript context is present.',
      ].join(' ');
    case 'general-knowledge':
    default:
      return [
        'MODE C - NO RETRIEVED CONTEXT: no useful transcript chunks were retrieved.',
        'lectureContent: briefly say the retrieved lecture context did not contain enough information.',
        'additionalExplanation: empty unless needed for a transition.',
        'generalKnowledge: provide a complete, helpful explanation using your own knowledge if it answers the student.',
        'Never fabricate lecture quotes or timestamps.',
        'suggestedRelatedTopics: 2-4 adjacent topics the student might explore next.',
      ].join(' ');
  }
}
