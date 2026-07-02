import type { ScoredChunkResult } from '../retrieval.service.js';

export type CoverageCase = 'strong' | 'partial' | 'none';

export type RetrievalAnalysis = {
  coverage: CoverageCase;
  maxSimilarity: number;
  avgTopSimilarity: number;
  chunkCount: number;
  topChunkIds: string[];
};

/** Normalize hybrid scores to 0–1 for coverage decisions. */
export function chunkSimilarity(result: ScoredChunkResult): number {
  const semantic = result.semanticSimilarity ?? 0;
  const keyword = result.keywordSimilarity ?? 0;
  if (semantic > 0 && keyword > 0) {
    return Math.min(1, semantic * 0.65 + keyword * 0.35);
  }
  return Math.max(semantic, keyword);
}

export function analyzeRetrieval(results: ScoredChunkResult[]): RetrievalAnalysis {
  if (!results.length) {
    return {
      coverage: 'none',
      maxSimilarity: 0,
      avgTopSimilarity: 0,
      chunkCount: 0,
      topChunkIds: [],
    };
  }

  const sims = results.map(chunkSimilarity);
  const maxSimilarity = Math.max(...sims);
  const top = sims.slice(0, Math.min(3, sims.length));
  const avgTopSimilarity = top.reduce((a, b) => a + b, 0) / top.length;
  const topChunkIds = results.slice(0, 5).map((r) => r.chunk.id);

  let coverage: CoverageCase = 'partial';
  if (maxSimilarity >= 0.62 || (maxSimilarity >= 0.48 && avgTopSimilarity >= 0.34)) {
    coverage = 'strong';
  }

  return {
    coverage,
    maxSimilarity,
    avgTopSimilarity,
    chunkCount: results.length,
    topChunkIds,
  };
}
