import { AppError } from '../utils/appError.js';

import { embeddingService } from './embedding.service.js';

import { pineconeService } from './pinecone.service.js';

import {

  retrievalService,

  type ScoredChunkResult,

  type SemanticChunkInput,

} from './retrieval.service.js';



export type { SemanticChunkInput, ScoredChunkResult };



/**

 * RAG pipeline orchestrator:

 * Indexing: chunk input → Gemini embeddings → Pinecone upsert

 * Retrieval: keyword search + Pinecone semantic query → merge & rank

 */

import { ragDevLog } from './rag/devLog.js';

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
    const started = Date.now();
    const keyword = retrievalService.keywordSearch(params.question, params.chunks, params.topK);

    if (!pineconeService.isEnabled()) {
      ragDevLog('retrieve', {
        mode: 'keyword-only',
        question: params.question,
        topK: params.topK,
        filters: { videoId: params.videoId, playlistId: params.playlistId ?? null },
        keywordHits: keyword.length,
        chunkIds: keyword.map((r) => r.chunk.id),
        scores: keyword.map((r) => ({
          id: r.chunk.id,
          keyword: r.keywordSimilarity,
          semantic: r.semanticSimilarity,
        })),
        ms: Date.now() - started,
      });
      return keyword;
    }

    const queryVec = await embeddingService.embedQuery(params.question);
    ragDevLog('query-embedding', {
      question: params.question,
      dimensions: queryVec.length,
    });

    if (!queryVec.length) {
      return keyword;
    }

    const vectorHits = await pineconeService.query({
      userId: params.userId,
      videoId: params.videoId,
      queryEmbedding: queryVec,
      topK: params.topK,
      filter: {
        videoId: params.videoId,
        playlistId: params.playlistId,
      },
    });

    const merged = retrievalService.mergeHybridResults(
      keyword,
      vectorHits,
      params.chunks,
      params.topK
    );

    ragDevLog('retrieve', {
      mode: 'hybrid',
      question: params.question,
      topK: params.topK,
      filters: { videoId: params.videoId, playlistId: params.playlistId ?? null },
      keywordHits: keyword.length,
      vectorHits: vectorHits.length,
      selected: merged.length,
      chunkIds: merged.map((r) => r.chunk.id),
      scores: merged.map((r) => ({
        id: r.chunk.id,
        keyword: r.keywordSimilarity,
        semantic: r.semanticSimilarity,
        rank: r.score,
      })),
      ms: Date.now() - started,
    });

    return merged;
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

