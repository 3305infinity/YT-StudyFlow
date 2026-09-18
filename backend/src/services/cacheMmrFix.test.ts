import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mmr, type MMRCandidate } from './mmr.service.js';
import { CacheManager } from '../cache/cacheManager.js';
import { ragService } from './rag.service.js';
import { pineconeService } from './pinecone.service.js';
import { embeddingService } from './embedding.service.js';

function dummyVector(val: number): number[] {
  return new Array(768).fill(val);
}

describe('Retrieval Cache & MMR Reranking Fix Unit Tests', () => {
  it('should preserve values in RetrievalResult cache manager data model', () => {
    const cache = new CacheManager({ enabled: true });
    const mockResults = [
      {
        id: 'chunk_1',
        score: 0.92,
        metadata: { text: 'Data Structures' },
        values: dummyVector(0.1),
      },
      {
        id: 'chunk_2',
        score: 0.85,
        metadata: { text: 'Algorithms' },
        values: dummyVector(0.2),
      },
    ];

    cache.setRetrieval('test_query', 'video_1', mockResults);

    const hit = cache.getRetrieval('test_query', 'video_1');
    assert.equal(hit.hit, true);
    assert.ok(hit.value);
    assert.equal(hit.value.length, 2);
    assert.ok(hit.value[0]?.values, 'Expected values array to be preserved in cache hit');
    assert.equal(hit.value[0]?.values?.length, 768);
  });

  it('should rank candidates without values using candidate.score instead of returning 0 items', () => {
    const queryVec = dummyVector(0.5);
    const candidatesWithoutValues: MMRCandidate[] = [
      {
        id: 'chunk_a',
        score: 0.95,
        metadata: { text: 'High score candidate' },
        values: undefined,
      },
      {
        id: 'chunk_b',
        score: 0.82,
        metadata: { text: 'Medium score candidate' },
        values: undefined,
      },
    ];

    const result = mmr(queryVec, candidatesWithoutValues, { finalK: 2 });
    assert.equal(result.length, 2, 'Expected 2 items returned despite missing values array');
    assert.equal(result[0]?.id, 'chunk_a');
    assert.equal(result[1]?.id, 'chunk_b');
  });

  it('should produce identical deterministic MMR ranking between cache miss and cache hit', async () => {
    const queryVec = dummyVector(0.1);
    const mockPineconeHits = [
      {
        id: 'c1',
        score: 0.90,
        metadata: { text: 'Concept 1' },
        values: dummyVector(0.1),
      },
      {
        id: 'c2',
        score: 0.88,
        metadata: { text: 'Concept 2' },
        values: dummyVector(0.12),
      },
      {
        id: 'c3',
        score: 0.80,
        metadata: { text: 'Concept 3' },
        values: dummyVector(0.15),
      },
    ];

    const origQuery = pineconeService.query;
    const origEmbed = embeddingService.embedQuery;

    pineconeService.query = async () => mockPineconeHits;
    embeddingService.embedQuery = async () => queryVec;

    try {
      const chunksInput = mockPineconeHits.map((h) => ({
        id: h.id,
        text: h.metadata.text,
        startTime: 0,
        endTime: 10,
        videoId: 'v123',
      }));

      // Call 1: Cache Miss
      const resultsMiss = await ragService.retrieve({
        userId: 'u1',
        videoId: 'v123',
        question: 'deterministic test question unique',
        chunks: chunksInput,
        topK: 3,
      });

      // Call 2: Cache Hit
      const resultsHit = await ragService.retrieve({
        userId: 'u1',
        videoId: 'v123',
        question: 'deterministic test question unique',
        chunks: chunksInput,
        topK: 3,
      });

      assert.equal(resultsMiss.length, 3);
      assert.equal(resultsHit.length, 3);
      assert.deepEqual(
        resultsMiss.map((r) => r.chunk.id),
        resultsHit.map((r) => r.chunk.id),
        'Expected exact match between cache miss and cache hit MMR ranking'
      );
    } finally {
      pineconeService.query = origQuery;
      embeddingService.embedQuery = origEmbed;
    }
  });
});
