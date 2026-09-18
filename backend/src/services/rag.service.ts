import { AppError } from '../utils/appError.js';
import { embeddingService } from './embedding.service.js';
import { pineconeService } from './pinecone.service.js';
import { retrievalService, type ScoredChunkResult, type SemanticChunkInput } from './retrieval.service.js';
import { mmr, type MMRConfig } from './mmr.service.js';
import { contextPackingService } from './contextPacking.service.js';
import { queryRewriteService, type QueryRewriteResult } from './queryRewrite.service.js';
import { metricsService } from './metrics.service.js';
import { retrievalMetrics } from './retrievalMetrics.js';
import { cacheManager } from '../cache/cacheManager.js';
import { ragDevLog } from './rag/devLog.js';
import { requestDeduplicator } from '../performance/requestDeduplicator.js';
import type { RetrievalResult } from '../cache/cacheManager.js';
import { withTimeout } from '../reliability/timeout.js';

export type { SemanticChunkInput, ScoredChunkResult };
export type { QueryRewriteResult };

export const ragService = {
  async embedChunks(chunks: SemanticChunkInput[]): Promise<Array<SemanticChunkInput & { embedding: number[] }>> {
    return embeddingService.embedDocuments(chunks);
  },

  async indexVideo(params: {
    userId: string;
    videoId: string;
    chunks: SemanticChunkInput[];
  }): Promise<Array<SemanticChunkInput & { embedding?: number[] }>> {
    const embedded = await embeddingService.embedDocuments(params.chunks);

    if (pineconeService.isEnabled() && embedded.length) {
      await pineconeService.upsertChunks({
        userId: params.userId,
        videoId: params.videoId,
        chunks: embedded.map((c) => ({
          ...c,
          embedding: c.embedding,
        })),
      });
    }

    return embedded;
  },

  async retrieve(params: {
    userId: string;
    videoId: string;
    question: string;
    chunks: SemanticChunkInput[];
    topK: number;
    playlistId?: string;
  }): Promise<ScoredChunkResult[]> {
    const dedupeKey = `retrieve:${params.userId}:${params.videoId}:${params.question}:${params.playlistId ?? ''}:${params.topK}`;

    return requestDeduplicator.execute(dedupeKey, async () => {
      const totalStart = Date.now();

      const cachedRewrite = cacheManager.getQueryRewrite(params.question);
      if (cachedRewrite.hit && cachedRewrite.value) {
        ragDevLog('cache-hit', { type: 'queryRewrite', query: params.question });
      }

      let rewriteResult: QueryRewriteResult;
      try {
        rewriteResult = cachedRewrite.hit && cachedRewrite.value
          ? { original: params.question, rewritten: cachedRewrite.value, wasRewritten: params.question !== cachedRewrite.value }
          : await queryRewriteService.rewrite(params.question);
      } catch (error) {
        ragDevLog('query-rewrite-failed', { error: String(error) });
        rewriteResult = { original: params.question, rewritten: params.question, wasRewritten: false };
      }

      if (!cachedRewrite.hit) {
        cacheManager.setQueryRewrite(params.question, rewriteResult.rewritten);
      }

      const retrievalQuery = rewriteResult.rewritten;
      const keyword = retrievalService.keywordSearch(retrievalQuery, params.chunks, params.topK);

      ragDevLog('query-rewrite', {
        original: rewriteResult.original,
        rewritten: rewriteResult.rewritten,
        wasRewritten: rewriteResult.wasRewritten,
      });

      if (!pineconeService.isEnabled()) {
        return keyword;
      }

      const cachedEmbedding = cacheManager.getEmbedding(retrievalQuery);
      if (cachedEmbedding.hit && cachedEmbedding.value) {
        ragDevLog('cache-hit', { type: 'embedding', query: retrievalQuery });
      }

      let queryVec: number[];
      try {
        queryVec = cachedEmbedding.hit && cachedEmbedding.value
          ? cachedEmbedding.value
          : await withTimeout(
              embeddingService.embedQuery(retrievalQuery),
              { timeoutMs: 10000, serviceName: 'embedding' }
            );
      } catch (error) {
        ragDevLog('embedding-failed', { error: String(error) });
        return keyword;
      }

      if (!cachedEmbedding.hit) {
        cacheManager.setEmbedding(retrievalQuery, queryVec);
      }

      ragDevLog('query-embedding', {
        question: params.question,
        retrievalQuery,
        dimensions: queryVec.length,
      });

      if (!queryVec.length) {
        return keyword;
      }

      const MMR_CANDIDATE_K = 40;
      const MMR_FINAL_K = params.topK;
      const MMR_LAMBDA = 0.7;

      const mmrConfig: MMRConfig = {
        lambda: MMR_LAMBDA,
        candidateK: MMR_CANDIDATE_K,
        finalK: MMR_FINAL_K,
      };

      const cachedRetrieval = cacheManager.getRetrieval(retrievalQuery, params.videoId, params.playlistId);
      let vectorHits: Array<{ id: string; score: number; metadata: Record<string, unknown>; values?: number[] }>;

      if (cachedRetrieval.hit && cachedRetrieval.value) {
        vectorHits = cachedRetrieval.value.map((h) => ({
          id: h.id,
          score: h.score,
          metadata: h.metadata,
          values: h.values,
        }));
      } else {
        try {
          vectorHits = await withTimeout(
            pineconeService.query({
              userId: params.userId,
              videoId: params.videoId,
              queryEmbedding: queryVec,
              topK: MMR_CANDIDATE_K,
              filter: {
                videoId: params.videoId,
                playlistId: params.playlistId,
              },
              queryText: retrievalQuery,
            }),
            { timeoutMs: 12000, serviceName: 'pinecone' }
          );
          const retrievalResults: RetrievalResult[] = vectorHits.map((h) => ({
            id: h.id,
            score: h.score,
            metadata: h.metadata,
            values: h.values,
          }));
          cacheManager.setRetrieval(retrievalQuery, params.videoId, retrievalResults, params.playlistId);
        } catch (error) {
          ragDevLog('pinecone-failed', { error: String(error) });
          return keyword;
        }
      }

      const pineconeLatencyMs = Date.now() - totalStart;

      const mmrCandidates = vectorHits.map((h) => ({
        id: h.id,
        score: h.score,
        metadata: h.metadata,
        values: h.values as number[] | undefined,
      }));

      let mmrRanked: Array<{ id: string; score: number; metadata: Record<string, unknown>; values?: number[] }>;
      try {
        mmrRanked = mmr(queryVec, mmrCandidates, mmrConfig);
      } catch (error) {
        ragDevLog('mmr-failed', { error: String(error) });
        mmrRanked = vectorHits;
      }
      const mmrLatencyMs = Date.now() - totalStart - pineconeLatencyMs;
      const mmrChunkIds = new Set(mmrRanked.map((r) => r.id));

      const finalResults: ScoredChunkResult[] = [];

      for (const r of mmrRanked) {
        const chunk = params.chunks.find((c) => c.id === r.id);
        if (chunk) {
          finalResults.push({
            chunk,
            score: r.score,
            keywordSimilarity: 0,
            semanticSimilarity: r.score,
            sources: ['semantic'],
          });
        }
      }

      const remainingKeyword = keyword.filter((k) => !mmrChunkIds.has(k.chunk.id)).slice(0, MMR_FINAL_K - finalResults.length);

      for (const k of remainingKeyword) {
        if (finalResults.length >= MMR_FINAL_K) break;
        finalResults.push(k);
      }

      const chunkIds = finalResults.map((r) => r.chunk.id);
      const cachedPacking = cacheManager.getPacking(params.videoId, chunkIds);

      let packedContexts: Array<{ text: string; tokenCount: number; metadata: Record<string, unknown> }>;
      try {
        packedContexts = cachedPacking.hit && cachedPacking.value
          ? cachedPacking.value
          : contextPackingService.pack(finalResults);

        if (!cachedPacking.hit) {
          cacheManager.setPacking(params.videoId, chunkIds, packedContexts);
        }
      } catch (error) {
        ragDevLog('packing-failed', { error: String(error) });
        packedContexts = finalResults.map((r) => ({
          text: r.chunk.text,
          tokenCount: Math.ceil(r.chunk.text.length / 4),
          metadata: { chunkId: r.chunk.id },
        }));
      }
      const packingLatencyMs = Date.now() - totalStart - pineconeLatencyMs - mmrLatencyMs;

      const totalLatencyMs = Date.now() - totalStart;

      if (metricsService.isEnabled()) {
        try {
          retrievalMetrics.log({
            query: params.question,
            rewrittenQuery: rewriteResult.wasRewritten ? rewriteResult.rewritten : undefined,
            rewriteApplied: rewriteResult.wasRewritten,
            candidateChunks: vectorHits.length,
            mmrChunks: mmrRanked.length,
            packedContexts: packedContexts.length,
            promptTokens: packedContexts.reduce((sum, p) => sum + p.tokenCount, 0),
            latencies: {
              pineconeMs: pineconeLatencyMs,
              mmrMs: mmrLatencyMs,
              packingMs: packingLatencyMs,
              promptMs: 0,
              generationMs: 0,
              totalMs: totalLatencyMs,
            },
          });
        } catch (error) {
          ragDevLog('metrics-failed', { error: String(error) });
        }
      }

      return finalResults;
    });
  },

  assertVectorSearchAvailable(): void {
    if (!pineconeService.isEnabled()) {
      throw new AppError(
        503,
        'Vector search unavailable. Configure PINECONE_API_KEY on the backend.'
      );
    }
  },
};