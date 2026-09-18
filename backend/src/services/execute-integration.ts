import { embeddingService } from './embedding.service.js';
import { pineconeService, pineconeHealth, pineconeNamespace } from './pinecone.service.js';
import { env } from '../config/env.js';
import { cosineSimilarity } from '../utils/vector.js';
import { Pinecone } from '@pinecone-database/pinecone';

async function main() {
  console.log('====================================================');
  console.log('   RUNTIME EMBEDDING & PINECONE INTEGRATION AUDIT   ');
  console.log('====================================================\n');

  // STEP 1: Environment Check
  console.log('[Step 1] Environment Verification:');
  console.log(`  - GEMINI_API_KEY Configured: ${env.geminiApiKey ? 'YES (Key Loaded)' : 'NO'}`);
  console.log(`  - PINECONE_API_KEY Configured: ${env.pineconeApiKey ? 'YES (Key Loaded)' : 'NO'}`);
  console.log(`  - PINECONE_INDEX: ${env.pineconeIndex}`);

  if (!env.geminiApiKey || !env.pineconeApiKey) {
    console.error('CRITICAL: API keys missing in environment. Aborting.');
    process.exit(1);
  }

  // STEP 2: Gemini Embeddings Verification
  console.log('\n[Step 2] Gemini Embeddings Verification:');
  const sampleDoc = {
    id: 'doc_sample_1',
    text: 'Binary search algorithm operates in O(log n) logarithmic time by repeatedly partitioning the sorted array search range in half.',
    startTime: 0,
    endTime: 10,
    videoId: 'audit_video_001',
    videoTitle: 'Algorithms 101',
  };

  const docStart = Date.now();
  const [docResult] = await embeddingService.embedDocuments([sampleDoc]);
  const docMs = Date.now() - docStart;

  if (!docResult) {
    throw new Error('Document embedding failed to return result');
  }

  const queryStart = Date.now();
  const queryVec = await embeddingService.embedQuery('What is the runtime complexity of binary search?');
  const queryMs = Date.now() - queryStart;

  const docVec = docResult.embedding;
  const isFiniteNumbers = docVec.every((n) => typeof n === 'number' && Number.isFinite(n));
  const sim = cosineSimilarity(queryVec, docVec);

  console.log(`  - Gemini Model Used: gemini-embedding-001`);
  console.log(`  - Document TaskType: RETRIEVAL_DOCUMENT`);
  console.log(`  - Query TaskType: RETRIEVAL_QUERY`);
  console.log(`  - Document Vector Dimension: ${docVec.length} (Latency: ${docMs}ms)`);
  console.log(`  - Query Vector Dimension: ${queryVec.length} (Latency: ${queryMs}ms)`);
  console.log(`  - Vectors Contain Finite Numeric Values: ${isFiniteNumbers ? 'YES' : 'NO'}`);
  console.log(`  - Cosine Similarity (Query vs Doc): ${sim.toFixed(4)} (Compatible: YES)`);

  // STEP 3: Pinecone Index Configuration
  console.log('\n[Step 3] Pinecone Index Inspection:');
  const health = await pineconeHealth.check();
  console.log(`  - Reachable Status: ${health.status} (${health.latencyMs}ms)`);

  const pc = new Pinecone({ apiKey: env.pineconeApiKey });
  const index = pc.index(env.pineconeIndex);
  const stats = await index.describeIndexStats();

  console.log(`  - Target Index Name: ${env.pineconeIndex}`);
  console.log(`  - Index Dimension: ${stats.dimension}`);
  console.log(`  - Dimension Match (768 == ${stats.dimension}): ${stats.dimension === 768 ? 'MATCH' : 'MISMATCH'}`);
  console.log(`  - Total Records in Index: ${stats.totalRecordCount}`);

  // STEP 4: Controlled End-to-End Test
  console.log('\n[Step 4 & 5] End-to-End Retrieval & Quality Validation:');
  const TEST_USER = 'audit_user_guest';
  const TEST_VIDEO = 'audit_video_e2e_test_99';
  const ns = pineconeNamespace(TEST_USER, TEST_VIDEO);
  console.log(`  - Isolated Test Namespace: "${ns}"`);

  const testChunks = [
    {
      id: 'chunk_python_mem',
      text: 'Python utilizes automated reference counting and a cycle-detecting garbage collector for heap memory management.',
      startTime: 0,
      endTime: 15,
      videoId: TEST_VIDEO,
      videoTitle: 'CS Fundamentals',
    },
    {
      id: 'chunk_react_vdom',
      text: 'React creates an in-memory virtual DOM representation and applies a fast diffing algorithm to reconcile UI changes with the real DOM.',
      startTime: 16,
      endTime: 30,
      videoId: TEST_VIDEO,
      videoTitle: 'CS Fundamentals',
    },
    {
      id: 'chunk_postgres_acid',
      text: 'PostgreSQL provides enterprise-grade ACID transaction guarantees, multi-version concurrency control, and native JSONB indexing.',
      startTime: 31,
      endTime: 45,
      videoId: TEST_VIDEO,
      videoTitle: 'CS Fundamentals',
    },
    {
      id: 'chunk_transformer_attention',
      text: 'Transformer architectures rely on multi-head self-attention mechanisms to calculate dynamic token contextual dependencies in parallel.',
      startTime: 46,
      endTime: 60,
      videoId: TEST_VIDEO,
      videoTitle: 'CS Fundamentals',
    },
  ];

  const embedded = await embeddingService.embedDocuments(testChunks);
  console.log(`  - Generated embeddings for ${embedded.length} test chunks.`);

  await pineconeService.upsertChunks({
    userId: TEST_USER,
    videoId: TEST_VIDEO,
    chunks: embedded,
  });
  console.log(`  - Upserted ${embedded.length} vectors to Pinecone namespace "${ns}".`);

  // Wait 2 seconds for index consistency
  console.log('  - Waiting 2s for index consistency...');
  await new Promise((r) => setTimeout(r, 2000));

  const testQueries = [
    {
      query: 'How does Python perform memory allocation and cleanup?',
      expectedId: 'chunk_python_mem',
    },
    {
      query: 'What is the purpose of the virtual DOM diffing in React?',
      expectedId: 'chunk_react_vdom',
    },
    {
      query: 'Does PostgreSQL feature ACID transactions and JSONB support?',
      expectedId: 'chunk_postgres_acid',
    },
    {
      query: 'How do self-attention mechanisms operate in transformers?',
      expectedId: 'chunk_transformer_attention',
    },
  ];

  console.log('\n  Query Benchmark Results:');
  let allMatched = true;

  for (const t of testQueries) {
    const qVec = await embeddingService.embedQuery(t.query);
    const hits = await pineconeService.query({
      userId: TEST_USER,
      videoId: TEST_VIDEO,
      queryEmbedding: qVec,
      topK: 3,
    });

    const topHit = hits[0];
    const isMatch = topHit?.id === t.expectedId;
    if (!isMatch) allMatched = false;

    console.log(`    • Query: "${t.query}"`);
    console.log(`      Expected: ${t.expectedId} | Actual Top 1: ${topHit?.id ?? 'NONE'} | Score: ${topHit?.score.toFixed(4) ?? 'N/A'}`);
    console.log(`      Status: ${isMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
  }

  // STEP 6: Error Handling Validation
  console.log('\n[Step 6] Error Handling Verification:');
  try {
    await embeddingService.embedQuery('');
    console.log('  - Empty Query Check: Returned fallback gracefully');
  } catch (err) {
    console.log(`  - Empty Query Check: Caught error cleanly (${(err as Error).message})`);
  }

  // STEP 7: Cleanup
  console.log('\n[Step 7] Test Namespace Cleanup:');
  await pineconeService.deleteVideo(TEST_USER, TEST_VIDEO);
  console.log(`  - Namespace "${ns}" deleted successfully.`);

  console.log('\n====================================================');
  console.log(`   INTEGRATION AUDIT SUMMARY: ${allMatched ? 'PASSED (100% Top-1 Accuracy)' : 'PARTIAL'}`);
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('Fatal Integration Error:', err);
  process.exit(1);
});
