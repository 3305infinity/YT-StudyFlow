import type { RetrievalAnalysis } from './coverage.js';

export type ConfidenceLabel = 'high' | 'medium' | 'low';

export function computeConfidence(analysis: RetrievalAnalysis): {
  score: number;
  label: ConfidenceLabel;
} {
  const { maxSimilarity, avgTopSimilarity, coverage, chunkCount } = analysis;

  if (chunkCount === 0 || coverage === 'none') {
    return { score: 0.2, label: 'low' };
  }

  const blended = maxSimilarity * 0.6 + avgTopSimilarity * 0.4;

  if (maxSimilarity > 0.9 || blended > 0.85) {
    return { score: Math.min(0.98, blended), label: 'high' };
  }
  if (maxSimilarity >= 0.7 || blended >= 0.62) {
    return { score: Math.min(0.88, blended), label: 'medium' };
  }
  return { score: Math.max(0.25, Math.min(0.65, blended)), label: 'low' };
}
