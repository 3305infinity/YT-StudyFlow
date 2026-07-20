import { isMetricsEnabled } from './metrics.service.js';

export type RetrievalMetrics = {
  query: string;
  rewrittenQuery?: string;
  rewriteApplied: boolean;
  candidateChunks: number;
  mmrChunks: number;
  packedContexts: number;
  promptTokens: number;
  retrievalLatencyMs: number;
  queryRewriteLatencyMs?: number;
  pineconeLatencyMs: number;
  mmrLatencyMs: number;
  packingLatencyMs: number;
  promptLatencyMs: number;
  generationLatencyMs: number;
  totalLatencyMs: number;
};

export type MetricsInput = {
  query: string;
  rewrittenQuery?: string;
  rewriteApplied: boolean;
  candidateChunks: number;
  mmrChunks: number;
  packedContexts: number;
  promptTokens: number;
  latencies: {
    queryRewriteMs?: number;
    pineconeMs: number;
    mmrMs: number;
    packingMs: number;
    promptMs: number;
    generationMs: number;
    totalMs: number;
  };
};

export function logRetrievalMetrics(input: MetricsInput): RetrievalMetrics {
  const metrics: RetrievalMetrics = {
    query: input.query,
    rewrittenQuery: input.rewrittenQuery,
    rewriteApplied: input.rewriteApplied,
    candidateChunks: input.candidateChunks,
    mmrChunks: input.mmrChunks,
    packedContexts: input.packedContexts,
    promptTokens: input.promptTokens,
    retrievalLatencyMs: input.latencies.pineconeMs,
    queryRewriteLatencyMs: input.latencies.queryRewriteMs,
    pineconeLatencyMs: input.latencies.pineconeMs,
    mmrLatencyMs: input.latencies.mmrMs,
    packingLatencyMs: input.latencies.packingMs,
    promptLatencyMs: input.latencies.promptMs,
    generationLatencyMs: input.latencies.generationMs,
    totalLatencyMs: input.latencies.totalMs,
  };

  if (isMetricsEnabled()) {
    console.log('[RAG-Metrics]', JSON.stringify(metrics));
  }

  return metrics;
}

export const retrievalMetrics = {
  log: logRetrievalMetrics,
};