import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { embeddingService } from './embedding.service.js';
import { pineconeService, pineconeHealth, pineconeNamespace } from './pinecone.service.js';
import { env } from '../config/env.js';
import { cosineSimilarity } from '../utils/vector.js';
import { Pinecone } from '@pinecone-database/pinecone';

const TEST_USER = 'integration_audit_user';
const TEST_VIDEO = 'audit_video_e2e_8899';

const SAMPLE_CHUNKS = [
  {
    id: 'chunk_python_mem',
    text: 'Python relies on reference counting and a generational garbage collector to manage heap memory automatically.',
    startTime: 0,
    endTime: 15,
    videoId: TEST_VIDEO,
    videoTitle: 'Programming Languages Deep Dive',
  },
  {
    id: 'chunk_react_vdom',
    text: 'React constructs an in-memory virtual DOM tree and uses a reconciliation diffing algorithm to update real DOM nodes efficiently.',
    startTime: 16,
    endTime: 30,
    videoId: TEST_VIDEO,
    videoTitle: 'Programming Languages Deep Dive',
  },
  {
    id: 'chunk_postgres_acid',
    text: 'PostgreSQL is an advanced relational database system supporting full ACID compliance, multi-version concurrency control (MVCC), and JSONB fields.',
    startTime: 31,
    endTime: 45,
    videoId: TEST_VIDEO,
    videoTitle: 'Programming Languages Deep Dive',
  },
  {
    id: 'chunk_transformer_attention',
    text: 'Transformer models utilize multi-head self-attention mechanisms to compute contextual representations across input tokens in parallel.',
    startTime: 46,
    endTime: 60,
    videoId: TEST_VIDEO,
    videoTitle: 'Programming Languages Deep Dive',
  },
];

describe('Runtime Integration Audit: Gemini & Pinecone', () => {
  it('Step 2: Gemini Embeddings Verification', async () => {
    const docStart = Date.now();
    const docResults = await embeddingService.embedDocuments([SAMPLE_CHUNKS[0]!]);
    const docLatency = Date.now() - docStart;

    assert.equal(docResults.length, 1);
    const docVec = docResults[0]!.embedding;
    assert.ok(Array.isArray(docVec));
    assert.equal(docVec.length, 768, `Expected 768 dimensions, got ${docVec.length}`);
    assert.ok(docVec.every((n) => typeof n === 'number' && Number.isFinite(n)), 'Vector contains invalid non-numeric values');

    const queryStart = Date.now();
    const queryVec = await embeddingService.embedQuery('How does memory management work in Python?');
    const queryLatency = Date.now() - queryStart;

    assert.ok(Array.isArray(queryVec));
    assert.equal(queryVec.length, 768, `Expected 768 dimensions for query, got ${queryVec.length}`);
    assert.ok(queryVec.every((n) => typeof n === 'number' && Number.isFinite(n)));

    const sim = cosineSimilarity(queryVec, docVec);

    console.log('--- Step 2 Results ---');
    console.log(`Model: gemini-embedding-001`);
    console.log(`Doc Embed Latency: ${docLatency}ms | Query Embed Latency: ${queryLatency}ms`);
    console.log(`Dimensions: ${docVec.length}`);
    console.log(`Cosine Similarity (Python query vs Python chunk): ${sim.toFixed(4)}`);

    assert.ok(sim > 0.6, `Expected high similarity for matching query/doc, got ${sim}`);
  });

  it('Step 3 & 4 & 5: Pinecone Index & Controlled End-to-End Retrieval Quality', async () => {
    const health = await pineconeHealth.check();
    console.log('--- Step 3 Results ---');
    console.log(`Pinecone Health: ${health.status} (${health.latencyMs}ms)`);
    assert.equal(health.status, 'healthy', `Pinecone connection failed: ${health.error}`);

    const pc = new Pinecone({ apiKey: env.pineconeApiKey });
    const index = pc.index(env.pineconeIndex);
    const stats = await index.describeIndexStats();

    console.log(`Pinecone Index Name: ${env.pineconeIndex}`);
    console.log(`Index Dimension: ${stats.dimension}`);
    console.log(`Total Vector Count: ${stats.totalRecordCount}`);

    assert.equal(stats.dimension, 768, `Pinecone index dimension (${stats.dimension}) does not match Gemini 768 dimensions!`);

    const ns = pineconeNamespace(TEST_USER, TEST_VIDEO);
    console.log(`Isolated Test Namespace: ${ns}`);

    // Embed all 4 sample chunks
    const embeddedChunks = await embeddingService.embedDocuments(SAMPLE_CHUNKS);
    assert.equal(embeddedChunks.length, 4);

    // Upsert vectors to test namespace
    await pineconeService.upsertChunks({
      userId: TEST_USER,
      videoId: TEST_VIDEO,
      chunks: embeddedChunks,
    });

    console.log('Successfully upserted 4 test vectors to Pinecone.');
    await new Promise((r) => setTimeout(r, 2000)); // Wait for index consistency

    // Test queries
    const testCases = [
      {
        query: 'How does Python clean up memory?',
        expectedId: 'chunk_python_mem',
      },
      {
        query: 'What algorithm does React use for updating DOM nodes?',
        expectedId: 'chunk_react_vdom',
      },
      {
        query: 'Does Postgres support ACID compliance and JSON fields?',
        expectedId: 'chunk_postgres_acid',
      },
      {
        query: 'How do self-attention mechanisms work in transformers?',
        expectedId: 'chunk_transformer_attention',
      },
    ];

    console.log('--- Step 5 Retrieval Quality Results ---');
    for (const tc of testCases) {
      const qVec = await embeddingService.embedQuery(tc.query);
      const hits = await pineconeService.query({
        userId: TEST_USER,
        videoId: TEST_VIDEO,
        queryEmbedding: qVec,
        topK: 3,
      });

      assert.ok(hits.length > 0, `No hits returned for query: ${tc.query}`);
      const topHit = hits[0]!;
      console.log(`Query: "${tc.query}"`);
      console.log(`  Top Hit ID: ${topHit.id} (Expected: ${tc.expectedId})`);
      console.log(`  Score: ${topHit.score.toFixed(4)}`);
      console.log(`  Match Success: ${topHit.id === tc.expectedId ? 'YES' : 'NO'}`);

      assert.equal(topHit.id, tc.expectedId, `Top hit ${topHit.id} did not match expected ${tc.expectedId}`);
      assert.ok(topHit.score > 0.5, `Score ${topHit.score} was below 0.5 threshold`);
    }

    // Cleanup test namespace
    console.log('--- Step 7 Cleanup ---');
    await pineconeService.deleteVideo(TEST_USER, TEST_VIDEO);
    console.log(`Deleted namespace ${ns} successfully.`);
  });
});
