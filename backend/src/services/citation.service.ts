import type { SemanticChunkInput } from './retrieval.service.js';



export type Citation = {

  id: string;

  chunkId: string;

  startTime: number;

  endTime: number;

  excerpt: string;

  videoId?: string;

  videoTitle?: string;

  score?: number;

};



function formatTimestamp(seconds: number): string {

  const s = Math.max(0, Math.floor(seconds));

  const h = Math.floor(s / 3600);

  const m = Math.floor((s % 3600) / 60);

  const sec = s % 60;

  if (h > 0) {

    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

  }

  return `${m}:${String(sec).padStart(2, '0')}`;

}



export const citationService = {

  formatTimestamp,



  buildCitations(

    chunks: Array<{ chunk: SemanticChunkInput; score: number }>,

    limit = 5

  ): Citation[] {

    const seen = new Set<number>();

    const out: Citation[] = [];



    for (const { chunk, score } of chunks) {

      const t = Math.floor(chunk.startTime);

      if (seen.has(t)) continue;

      seen.add(t);

      out.push({

        id: `cite_${chunk.videoId}_${chunk.id}`,

        chunkId: chunk.id,

        startTime: chunk.startTime,

        endTime: chunk.endTime,

        excerpt: chunk.text.slice(0, 220).trim(),

        videoId: chunk.videoId,

        videoTitle: chunk.videoTitle,

        score,

      });

      if (out.length >= limit) break;

    }



    return out;

  },



  formatContextLine(chunk: SemanticChunkInput): string {

    return `[${formatTimestamp(chunk.startTime)}] ${chunk.text}`;

  },

};

