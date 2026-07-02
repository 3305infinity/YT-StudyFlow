import { geminiService, type EmbedInput, type EmbedOutput } from './gemini.service.js';

import { withRetry } from '../utils/retry.js';



const DEFAULT_MODEL = 'gemini-embedding-001';

const MAX_BATCH = 48;



export type ChunkForEmbedding = {

  id: string;

  text: string;

  startTime: number;

  endTime: number;

  videoId: string;

  videoTitle?: string;

  playlistId?: string;

  transcriptChunkIds?: string[];

};



export const embeddingService = {

  async embedDocuments(chunks: ChunkForEmbedding[]): Promise<Array<ChunkForEmbedding & { embedding: number[] }>> {

    const target = chunks.slice(0, MAX_BATCH);

    if (!target.length) return [];



    const { embeddings } = await withRetry(

      () =>

        geminiService.embedTexts({

          model: DEFAULT_MODEL,

          input: target.map((c) => c.text),

          taskType: 'RETRIEVAL_DOCUMENT',

        }),

      { label: 'embedDocuments' }

    );



    return target.map((chunk, i) => ({

      ...chunk,

      embedding: embeddings[i] ?? [],

    }));

  },



  async embedQuery(question: string): Promise<number[]> {

    const { embeddings } = await withRetry(

      () =>

        geminiService.embedTexts({

          model: DEFAULT_MODEL,

          input: [question],

          taskType: 'RETRIEVAL_QUERY',

        }),

      { label: 'embedQuery' }

    );

    return embeddings[0] ?? [];

  },



  async embedTexts(input: EmbedInput): Promise<EmbedOutput> {

    return withRetry(() => geminiService.embedTexts(input), { label: 'embedTexts' });

  },

};

