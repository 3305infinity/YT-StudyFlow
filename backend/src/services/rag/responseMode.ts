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
        'additionalExplanation: REQUIRED. Add helpful background or examples that complement the lecture.',
        'generalKnowledge: REQUIRED. Add factual context that fills gaps in the transcript.',
        'keyTakeaways: REQUIRED. Extract 3-5 specific study bullets.',
        'suggestedRelatedTopics: REQUIRED. Suggest 2-3 adjacent topics.',
        'Do not copy transcript sentences verbatim. Do not invent lecture quotes.',
      ].join(' ');
    case 'hybrid':
      return [
        'MODE B - HYBRID EXPLANATION: the retrieved transcript may only partially cover this topic.',
        'Use the retrieved chunks as the anchor, then add missing context that helps the student understand.',
        'lectureContent: explain the most relevant transcript-backed ideas naturally, with timestamp references when useful.',
        'additionalExplanation: REQUIRED. Fill gaps, simplify hard ideas, and connect concepts without pretending the extra context came from the lecture.',
        'generalKnowledge: REQUIRED. Provide factual standalone context.',
        'keyTakeaways: REQUIRED. Extract 3-5 specific study bullets.',
        'suggestedRelatedTopics: REQUIRED. Suggest 2-3 adjacent topics.',
        'Do not refuse just because similarity is low if relevant transcript context is present.',
      ].join(' ');
    case 'general-knowledge':
    default:
      return [
        'MODE C - NO RETRIEVED CONTEXT: no useful transcript chunks were retrieved.',
        'lectureContent: explain that the lecture did not cover this topic, then provide the best answer you can.',
        'additionalExplanation: REQUIRED. Add background and context.',
        'generalKnowledge: REQUIRED. Provide a complete, helpful explanation using your own knowledge.',
        'keyTakeaways: REQUIRED. Extract 3-5 specific study bullets.',
        'suggestedRelatedTopics: REQUIRED. Suggest 2-3 adjacent topics the student might explore next.',
        'Never fabricate lecture quotes or timestamps.',
      ].join(' ');
  }
}
