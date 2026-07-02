import type { ScoredChunkResult } from '../retrieval.service.js';

const STOP = new Set([
  'about', 'after', 'also', 'been', 'being', 'both', 'from', 'have', 'into', 'just',
  'like', 'more', 'most', 'only', 'other', 'some', 'such', 'than', 'that', 'their',
  'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'very', 'what',
  'when', 'where', 'which', 'while', 'with', 'would', 'your',
]);

function extractCandidateTerms(text: string): string[] {
  const terms: string[] = [];
  const camel = text.replace(/([a-z])([A-Z])/g, '$1 $2');
  const tokens = camel.toLowerCase().split(/\W+/).filter((t) => t.length >= 4);
  for (const t of tokens) {
    if (!STOP.has(t)) terms.push(t);
  }
  const phrases = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) ?? [];
  for (const p of phrases) terms.push(p.trim());
  return terms;
}

/** Topics grounded in retrieved transcript chunks (not LLM hallucination). */
export function lectureRelatedTopicsFromRetrieval(
  results: ScoredChunkResult[],
  limit = 5
): string[] {
  const freq = new Map<string, number>();
  for (const r of results.slice(0, 6)) {
    for (const term of extractCandidateTerms(r.chunk.text)) {
      const key = term.toLowerCase();
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([k]) => {
      if (/^[A-Z]/.test(k)) return k;
      return k.charAt(0).toUpperCase() + k.slice(1);
    });
}
