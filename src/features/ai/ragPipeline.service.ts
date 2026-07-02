import { CHUNKING, GEMINI } from '@lib/constants';

import { getPlaylistIdFromUrl } from '@lib/playlist';

import {

  DbIds,

  ensureDbReady,

  getDb,

  nowMs,

  type SemanticChunkRow,

} from '@lib/db';

import type { SemanticChunk } from '@/types/ai';

import type { EnhancedTranscriptChunk } from '@/types/transcript';

import { chunkTranscriptSemantically } from './chunking';

import { embedChunksForIndex, retrieveHybrid } from './hybridRetrieval';



/** Load chunk metadata from Dexie (vectors live in Pinecone, not locally). */

export async function loadSemanticChunksFromDb(videoId: string): Promise<SemanticChunk[] | null> {

  await ensureDbReady();

  const db = getDb();

  const rows = await db.semanticChunks.where('videoId').equals(videoId).toArray();

  if (!rows.length) return null;



  return rows.map((r) => ({

    id: r.semanticChunkId,

    text: r.text,

    startTime: r.startTime,

    endTime: r.endTime,

    transcriptChunkIds: r.transcriptChunkIds,

    embedding: null,

    videoId: r.videoId,

    videoTitle: r.videoTitle,

    playlistId: r.playlistId,

  }));

}



/** Persist chunk metadata only — embeddings are stored in Pinecone. */

async function persistSemanticIndex(

  videoId: string,

  chunks: SemanticChunk[],

  meta?: { playlistId?: string; videoTitle?: string }

): Promise<void> {

  const db = getDb();

  const ts = nowMs();



  await db.transaction('rw', db.semanticChunks, async () => {

    await db.semanticChunks.where('videoId').equals(videoId).delete();



    for (const chunk of chunks) {

      const row: SemanticChunkRow = {

        id: DbIds.semanticChunk(videoId, chunk.id),

        videoId,

        semanticChunkId: chunk.id,

        playlistId: meta?.playlistId ?? chunk.playlistId,

        videoTitle: meta?.videoTitle ?? chunk.videoTitle,

        text: chunk.text,

        startTime: chunk.startTime,

        endTime: chunk.endTime,

        transcriptChunkIds: chunk.transcriptChunkIds,

        createdAt: ts,

        updatedAt: ts,

        schemaVersion: 2,

      };

      await db.semanticChunks.put(row);

    }

  });

}



function chunkEnhanced(

  videoId: string,

  enhancedChunks: EnhancedTranscriptChunk[],

  meta?: { playlistId?: string; videoTitle?: string }

): SemanticChunk[] {

  const raw = chunkTranscriptSemantically(videoId, enhancedChunks, {

    maxChunkSize: CHUNKING.MAX_CHUNK_SIZE,

    minChunkSize: CHUNKING.MIN_CHUNK_SIZE,

    overlapSize: CHUNKING.OVERLAP_SIZE,

    respectSentences: true,

    respectParagraphs: true,

  });

  return raw.map((c) => ({

    ...c,

    videoId,

    videoTitle: meta?.videoTitle,

    playlistId: meta?.playlistId,

  }));

}



export async function buildKeywordOnlyIndex(

  videoId: string,

  enhancedChunks: EnhancedTranscriptChunk[],

  onProgress?: (stage: string) => void,

  meta?: { playlistId?: string; videoTitle?: string }

): Promise<SemanticChunk[]> {

  onProgress?.('Building local transcript index…');

  const rawChunks = chunkEnhanced(videoId, enhancedChunks, meta);

  await persistSemanticIndex(videoId, rawChunks, meta);

  return rawChunks;

}



export async function buildSemanticIndex(

  videoId: string,

  enhancedChunks: EnhancedTranscriptChunk[],

  onProgress?: (stage: string) => void,

  meta?: { playlistId?: string; videoTitle?: string }

): Promise<SemanticChunk[]> {

  onProgress?.('Checking cache…');

  const cached = await loadSemanticChunksFromDb(videoId);

  if (cached?.length) {

    onProgress?.('Re-indexing in Pinecone…');

    await embedChunksForIndex(cached, onProgress);

    return cached;

  }



  onProgress?.('Chunking transcript…');

  let rawChunks = chunkEnhanced(videoId, enhancedChunks, meta);

  if (!rawChunks.length) return [];



  if (GEMINI.EMBEDDINGS_ENABLED) {

    rawChunks = await embedChunksForIndex(rawChunks, onProgress);

    await persistSemanticIndex(videoId, rawChunks, meta);

    return rawChunks;

  }



  await persistSemanticIndex(videoId, rawChunks, meta);

  return rawChunks;

}



export async function retrieveRelevantChunks(

  question: string,

  chunks: SemanticChunk[],

  topK: number,

  _threshold: number,

  recentUserMessages: string[] = []

): Promise<SemanticChunk[]> {

  const scored = await retrieveHybrid(question, chunks, topK, recentUserMessages);

  return scored.map((r) => r.chunk);

}



export async function retrieveRelevantChunksWithScores(

  question: string,

  chunks: SemanticChunk[],

  topK: number,

  recentUserMessages: string[] = []

) {

  return retrieveHybrid(question, chunks, topK, recentUserMessages);

}



export function indexMetaFromPage(videoTitle?: string) {

  const playlistId = getPlaylistIdFromUrl() ?? undefined;

  return { playlistId, videoTitle };

}



export async function testBackendConnection(): Promise<{ ok: boolean; error?: string }> {

  try {

    const { api } = await import('@lib/api/client');

    await api.get<{ ok: boolean }>('/api/ai/health');

    return { ok: true };

  } catch (e) {

    const msg = e instanceof Error ? e.message : String(e);

    return { ok: false, error: msg };

  }

}

