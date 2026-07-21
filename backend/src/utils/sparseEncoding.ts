/**
 * BM25-style sparse vector encoding for Pinecone hybrid search.
 * Generates sparse values compatible with Pinecone's RecordSparseValues type.
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
  'it', 'its', 'they', 'them', 'their', 'we', 'you', 'your', 'he', 'she', 'his', 'her',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'about', 'with', 'from',
  'any', 'did', 'mention', 'mentioned', 'talk', 'talking', 'say', 'said', 'video', 'lecture',
  'ok', 'okay', 'yes', 'no', 'please', 'thanks', 'thank',
]);

const VOCABULARY_SIZE = 30000;

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ');
  const tokens = normalized.split(/\s+/).filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  return [...new Set(tokens)];
}

function hashToken(token: string): number {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % VOCABULARY_SIZE;
}

/**
 * Generate a sparse vector representation using BM25-style scoring.
 * For simplicity, we use term frequency with logarithmic weighting.
 */
export function generateSparseVector(text: string): {
  indices: number[];
  values: number[];
} {
  if (!text || text.length === 0) {
    return { indices: [], values: [] };
  }

  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return { indices: [], values: [] };
  }

  const termCounts = new Map<string, number>();
  for (const token of tokens) {
    termCounts.set(token, (termCounts.get(token) ?? 0) + 1);
  }

  const aggregated = new Map<number, number>();
  for (const [token, count] of termCounts) {
    const idx = hashToken(token);
    const tf = 1 + Math.log(count);
    const weight = Math.min(tf, 10);
    aggregated.set(idx, (aggregated.get(idx) ?? 0) + weight);
  }

  const indices = Array.from(aggregated.keys());
  const values = Array.from(aggregated.values());

  return { indices, values };
}

/**
 * Generate sparse vector from query text for hybrid search.
 * Uses simpler scoring for queries.
 */
export function generateQuerySparseVector(query: string): {
  indices: number[];
  values: number[];
} {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return { indices: [], values: [] };
  }

  const aggregated = new Map<number, number>();
  for (const token of tokens) {
    const idx = hashToken(token);
    aggregated.set(idx, (aggregated.get(idx) ?? 0) + 1.0);
  }

  const indices = Array.from(aggregated.keys());
  const values = Array.from(aggregated.values());

  return { indices, values };
}