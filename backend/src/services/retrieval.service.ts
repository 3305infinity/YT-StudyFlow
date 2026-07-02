export type SemanticChunkInput = {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  transcriptChunkIds?: string[];
  videoId: string;
  videoTitle?: string;
  playlistId?: string;
};

export type ScoredChunkResult = {
  chunk: SemanticChunkInput & { embedding?: number[] | null };
  /** Combined rank score used for ordering. */
  score: number;
  /** Raw keyword match strength 0–1. */
  keywordSimilarity: number;
  /** Raw vector cosine similarity 0–1 (0 if keyword-only). */
  semanticSimilarity: number;
  sources: Array<'keyword' | 'semantic'>;
};

const KEYWORD_WEIGHT = 1.0;
const SEMANTIC_WEIGHT = 2.5;

function splitQueryTerms(query: string): string[] {
  const expanded = query.replace(/([a-z])([A-Z])/g, '$1 $2');
  const raw = expanded.toLowerCase().split(/\W+/).filter((t) => t.length > 1);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function keywordScore(query: string, text: string): number {
  const terms = splitQueryTerms(query);
  if (!terms.length) return 0;
  const hay = text.toLowerCase().replace(/([a-z])([A-Z])/g, '$1 $2');
  let hits = 0;
  for (const term of terms) {
    if (hay.includes(term)) hits += 1;
  }
  return hits / terms.length;
}

export function keywordSearch(
  query: string,
  chunks: SemanticChunkInput[],
  topK: number
): ScoredChunkResult[] {
  const hits = chunks
    .map((chunk) => {
      const kw = keywordScore(query, chunk.text);
      return {
        chunk,
        score: kw * KEYWORD_WEIGHT,
        keywordSimilarity: kw,
        semanticSimilarity: 0,
        sources: ['keyword'] as Array<'keyword' | 'semantic'>,
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  if (hits.length || !chunks.length) return hits;

  const count = Math.min(topK, chunks.length);
  const step = (chunks.length - 1) / Math.max(count - 1, 1);
  const fallback: ScoredChunkResult[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const chunk = chunks[Math.round(i * step)]!;
    if (seen.has(chunk.id)) continue;
    seen.add(chunk.id);
    fallback.push({
      chunk,
      score: 0.05,
      keywordSimilarity: 0.05,
      semanticSimilarity: 0,
      sources: ['keyword'],
    });
  }
  return fallback;
}

export function mergeHybridResults(
  keyword: ScoredChunkResult[],
  semantic: Array<{ id: string; score: number; metadata: Record<string, unknown> }>,
  chunks: SemanticChunkInput[],
  topK: number
): ScoredChunkResult[] {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const merged = new Map<string, ScoredChunkResult>();

  for (const hit of keyword) {
    merged.set(hit.chunk.id, hit);
  }

  for (const hit of semantic) {
    const chunk =
      byId.get(hit.id) ??
      ({
        id: hit.id,
        text: String(hit.metadata.text ?? ''),
        startTime: Number(hit.metadata.startTime ?? 0),
        endTime: Number(hit.metadata.endTime ?? 0),
        videoId: String(hit.metadata.videoId ?? ''),
        videoTitle: String(hit.metadata.videoTitle ?? ''),
        playlistId: String(hit.metadata.playlistId ?? ''),
      } satisfies SemanticChunkInput);

    const prev = merged.get(hit.id);
    const semanticSim = Math.max(0, Math.min(1, hit.score));
    const semanticScore = semanticSim * SEMANTIC_WEIGHT;
    merged.set(hit.id, {
      chunk,
      score: (prev?.score ?? 0) + semanticScore,
      keywordSimilarity: prev?.keywordSimilarity ?? 0,
      semanticSimilarity: Math.max(prev?.semanticSimilarity ?? 0, semanticSim),
      sources: [...new Set([...(prev?.sources ?? []), 'semantic'] as const)] as Array<'keyword' | 'semantic'>,
    });
  }

  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, topK);
}

export const retrievalService = {
  keywordSearch,
  mergeHybridResults,
  keywordScore,
};
