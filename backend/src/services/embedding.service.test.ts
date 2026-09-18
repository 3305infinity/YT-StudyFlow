import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

import { embeddingService, type ChunkForEmbedding } from './embedding.service.js';
import { geminiService } from './gemini.service.js';

function createMockChunk(index: number): ChunkForEmbedding {
  return {
    id: `chunk_${index}`,
    text: `Transcript text segment ${index} explaining data structures and algorithms.`,
    startTime: index * 10,
    endTime: (index + 1) * 10,
    videoId: 'video_test_123',
    videoTitle: 'DSA Lecture',
  };
}

function createDummyVector(dimension = 768, val = 0.1): number[] {
  return new Array(dimension).fill(val);
}

describe('Embedding Service Batching & Pipeline Tests', () => {
  it('should handle empty input array (0 chunks)', async () => {
    const result = await embeddingService.embedDocuments([]);
    assert.deepEqual(result, []);
  });

  it('should process 10 chunks in a single batch with exact order and 1:1 mapping', async () => {
    const chunks = Array.from({ length: 10 }, (_, i) => createMockChunk(i));
    
    // Mock geminiService.embedTexts
    const originalEmbedTexts = geminiService.embedTexts;
    geminiService.embedTexts = async (input) => {
      assert.equal(input.input.length, 10);
      return {
        model: 'gemini-embedding-001',
        embeddings: input.input.map((_, i) => createDummyVector(768, (i + 1) * 0.01)),
      };
    };

    try {
      const result = await embeddingService.embedDocuments(chunks);
      assert.equal(result.length, 10);
      assert.equal(result[0]?.id, 'chunk_0');
      assert.equal(result[9]?.id, 'chunk_9');
      assert.equal(result[0]?.embedding.length, 768);
      assert.equal(result[9]?.embedding.length, 768);
      assert.equal(result[0]?.embedding[0], 0.01);
      assert.equal(result[9]?.embedding[0], 0.10);
    } finally {
      geminiService.embedTexts = originalEmbedTexts;
    }
  });

  it('should process 48 chunks (exact single batch boundary)', async () => {
    const chunks = Array.from({ length: 48 }, (_, i) => createMockChunk(i));
    let callCount = 0;

    const originalEmbedTexts = geminiService.embedTexts;
    geminiService.embedTexts = async (input) => {
      callCount++;
      assert.equal(input.input.length, 48);
      return {
        model: 'gemini-embedding-001',
        embeddings: input.input.map((_, i) => createDummyVector(768, i * 0.01)),
      };
    };

    try {
      const result = await embeddingService.embedDocuments(chunks);
      assert.equal(callCount, 1);
      assert.equal(result.length, 48);
      assert.equal(result[47]?.id, 'chunk_47');
    } finally {
      geminiService.embedTexts = originalEmbedTexts;
    }
  });

  it('should process 49 chunks across 2 sequential batches (48 + 1) without truncation', async () => {
    const chunks = Array.from({ length: 49 }, (_, i) => createMockChunk(i));
    const batchSizes: number[] = [];

    const originalEmbedTexts = geminiService.embedTexts;
    geminiService.embedTexts = async (input) => {
      batchSizes.push(input.input.length);
      return {
        model: 'gemini-embedding-001',
        embeddings: input.input.map(() => createDummyVector(768, 0.5)),
      };
    };

    try {
      const result = await embeddingService.embedDocuments(chunks);
      assert.deepEqual(batchSizes, [48, 1]);
      assert.equal(result.length, 49);
      assert.equal(result[0]?.id, 'chunk_0');
      assert.equal(result[47]?.id, 'chunk_47');
      assert.equal(result[48]?.id, 'chunk_48');
    } finally {
      geminiService.embedTexts = originalEmbedTexts;
    }
  });

  it('should process 100 chunks across 3 sequential batches (48 + 48 + 4)', async () => {
    const chunks = Array.from({ length: 100 }, (_, i) => createMockChunk(i));
    const batchSizes: number[] = [];

    const originalEmbedTexts = geminiService.embedTexts;
    geminiService.embedTexts = async (input) => {
      batchSizes.push(input.input.length);
      return {
        model: 'gemini-embedding-001',
        embeddings: input.input.map(() => createDummyVector(768, 0.2)),
      };
    };

    try {
      const result = await embeddingService.embedDocuments(chunks);
      assert.deepEqual(batchSizes, [48, 48, 4]);
      assert.equal(result.length, 100);
      assert.equal(result[0]?.id, 'chunk_0');
      assert.equal(result[99]?.id, 'chunk_99');
    } finally {
      geminiService.embedTexts = originalEmbedTexts;
    }
  });

  it('should process 150+ chunks across 4 sequential batches (48 + 48 + 48 + 6)', async () => {
    const chunks = Array.from({ length: 150 }, (_, i) => createMockChunk(i));
    const batchSizes: number[] = [];

    const originalEmbedTexts = geminiService.embedTexts;
    geminiService.embedTexts = async (input) => {
      batchSizes.push(input.input.length);
      return {
        model: 'gemini-embedding-001',
        embeddings: input.input.map(() => createDummyVector(768, 0.3)),
      };
    };

    try {
      const result = await embeddingService.embedDocuments(chunks);
      assert.deepEqual(batchSizes, [48, 48, 48, 6]);
      assert.equal(result.length, 150);
      assert.equal(result[0]?.id, 'chunk_0');
      assert.equal(result[149]?.id, 'chunk_149');
    } finally {
      geminiService.embedTexts = originalEmbedTexts;
    }
  });

  it('should throw error when API returns mismatched or empty embeddings array', async () => {
    const chunks = Array.from({ length: 5 }, (_, i) => createMockChunk(i));

    const originalEmbedTexts = geminiService.embedTexts;
    geminiService.embedTexts = async () => {
      return {
        model: 'gemini-embedding-001',
        embeddings: [createDummyVector(768)], // Only 1 vector returned for 5 input chunks
      };
    };

    try {
      await assert.rejects(
        async () => {
          await embeddingService.embedDocuments(chunks);
        },
        (err: Error) => {
          return err.message.includes('Embedding generation failed: expected 5 embeddings');
        }
      );
    } finally {
      geminiService.embedTexts = originalEmbedTexts;
    }
  });

  it('should throw error when API returns an empty vector for any chunk', async () => {
    const chunks = Array.from({ length: 3 }, (_, i) => createMockChunk(i));

    const originalEmbedTexts = geminiService.embedTexts;
    geminiService.embedTexts = async () => {
      return {
        model: 'gemini-embedding-001',
        embeddings: [createDummyVector(768), [], createDummyVector(768)], // 2nd chunk is empty []
      };
    };

    try {
      await assert.rejects(
        async () => {
          await embeddingService.embedDocuments(chunks);
        },
        (err: Error) => {
          return err.message.includes('Embedding generation returned an empty vector for chunk ID chunk_1');
        }
      );
    } finally {
      geminiService.embedTexts = originalEmbedTexts;
    }
  });

  it('should propagate API retry failures cleanly without partial corrupted vectors', async () => {
    const chunks = Array.from({ length: 10 }, (_, i) => createMockChunk(i));

    const originalEmbedTexts = geminiService.embedTexts;
    geminiService.embedTexts = async () => {
      throw new Error('Gemini API 503 Service Unavailable');
    };

    try {
      await assert.rejects(
        async () => {
          await embeddingService.embedDocuments(chunks);
        },
        (err: Error) => {
          return err.message.includes('Gemini API 503 Service Unavailable');
        }
      );
    } finally {
      geminiService.embedTexts = originalEmbedTexts;
    }
  });
});
