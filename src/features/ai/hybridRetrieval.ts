import { GEMINI, VECTOR_SEARCH } from '@lib/constants';

import type { SemanticChunk } from '@/types/ai';

import { retrieveRelevantChunksScored, type ScoredChunk } from './transcriptRetrieval';

import { canUseBackendAi } from '@lib/storage';

import { api, checkBackendHealth } from '@lib/api/client';



function toApiChunks(chunks: SemanticChunk[]) {

  return chunks.map((c) => ({

    id: c.id,

    text: c.text,

    startTime: c.startTime,

    endTime: c.endTime,

    transcriptChunkIds: c.transcriptChunkIds,

    videoId: c.videoId ?? '',

    videoTitle: c.videoTitle,

    playlistId: c.playlistId,

  }));

}



/**

 * Hybrid retrieval: keyword search (local) + semantic search (backend Pinecone).

 * Vectors are stored in Pinecone — no local IndexedDB embeddings.

 */

export async function retrieveHybrid(

  question: string,

  chunks: SemanticChunk[],

  topK: number = VECTOR_SEARCH.CHAT_TOP_K,

  recentUserMessages: string[] = []

): Promise<ScoredChunk[]> {

  const keyword = retrieveRelevantChunksScored(question, chunks, topK, recentUserMessages);



  if (!GEMINI.EMBEDDINGS_ENABLED || !chunks.length) {

    return keyword;

  }



  const backendOnline = await checkBackendHealth();

  if (!backendOnline || !(await canUseBackendAi())) {

    return keyword;

  }



  const videoId = chunks[0]?.videoId;

  const playlistId = chunks[0]?.playlistId;

  if (!videoId) return keyword;



  try {

    const resp = await api.post<{

      results: Array<{ chunk: SemanticChunk; score: number }>;

    }>('/api/rag/retrieve', {

      videoId,

      playlistId,

      question,

      chunks: toApiChunks(chunks),

      topK,

    });



    if (resp.results?.length) {

      return resp.results.map((r) => ({ chunk: r.chunk, score: r.score }));

    }

  } catch (e) {

    console.warn('[YT StudyFlow] Pinecone retrieval failed, using keyword fallback', e);

  }



  return keyword;

}



/** Index transcript chunks: backend embeds via Gemini and upserts to Pinecone. */

export async function embedChunksForIndex(

  chunks: SemanticChunk[],

  onProgress?: (msg: string) => void

): Promise<SemanticChunk[]> {

  if (!GEMINI.EMBEDDINGS_ENABLED || !chunks.length) return chunks;

  if (!(await canUseBackendAi())) return chunks;



  const backendOnline = await checkBackendHealth();

  if (!backendOnline) {

    onProgress?.('Backend offline — keyword search only');

    return chunks;

  }



  const cap = GEMINI.MAX_EMBED_CHUNKS > 0 ? GEMINI.MAX_EMBED_CHUNKS : chunks.length;

  const target = chunks.slice(0, cap);

  onProgress?.(`Indexing ${target.length} chunks in Pinecone…`);



  const videoId = target[0]?.videoId;

  if (!videoId) return chunks;



  try {

    await api.post<{ chunks: SemanticChunk[] }>('/api/rag/index', {

      videoId,

      chunks: toApiChunks(target),

    });

    onProgress?.('Indexed in Pinecone');

    return chunks;

  } catch (e) {

    console.warn('[YT StudyFlow] Pinecone indexing failed', e);

    onProgress?.('Indexing failed — keyword search only');

    return chunks;

  }

}

