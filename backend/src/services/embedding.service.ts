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
  async embedDocuments(
    chunks: ChunkForEmbedding[],
    batchSize = MAX_BATCH
  ): Promise<Array<ChunkForEmbedding & { embedding: number[] }>> {
    if (!chunks.length) return [];

    const effectiveBatchSize = Math.max(1, Math.min(batchSize, MAX_BATCH));
    const results: Array<ChunkForEmbedding & { embedding: number[] }> = [];

    for (let i = 0; i < chunks.length; i += effectiveBatchSize) {
      const batch = chunks.slice(i, i + effectiveBatchSize);

      const { embeddings } = await withRetry(
        () =>
          geminiService.embedTexts({
            model: DEFAULT_MODEL,
            input: batch.map((c) => c.text),
            taskType: 'RETRIEVAL_DOCUMENT',
          }),
        { label: `embedDocuments:batch:${i}` }
      );

      if (!embeddings || embeddings.length !== batch.length) {
        throw new Error(
          `Embedding generation failed: expected ${batch.length} embeddings for batch starting at index ${i}, received ${embeddings?.length ?? 0}`
        );
      }

      for (let j = 0; j < batch.length; j++) {
        const vec = embeddings[j];
        if (!vec || !vec.length) {
          throw new Error(`Embedding generation returned an empty vector for chunk ID ${batch[j]!.id}`);
        }
        results.push({
          ...batch[j]!,
          embedding: vec,
        });
      }
    }

    return results;
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

    const queryVector = embeddings[0];
    if (!queryVector || !queryVector.length) {
      throw new Error('Query embedding generation returned empty vector');
    }

    return queryVector;
  },

  async embedTexts(input: EmbedInput): Promise<EmbedOutput> {
    return withRetry(() => geminiService.embedTexts(input), { label: 'embedTexts' });
  },
};

