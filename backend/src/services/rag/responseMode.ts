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
      return 'TRANSCRIPT COVERAGE: strong. Ground every claim in the retrieved context. Cite timestamps when helpful. Do not invent lecture quotes.';
    case 'hybrid':
      return 'TRANSCRIPT COVERAGE: partial. Use the transcript as the anchor. Fill gaps with background knowledge. Do not refuse just because similarity is low.';
    case 'general-knowledge':
    default:
      return 'TRANSCRIPT COVERAGE: none. The lecture did not cover this topic. Provide the best answer using your knowledge. Never fabricate lecture quotes or timestamps.';
  }
}
