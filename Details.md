# YT StudyFlow Technical Details

A comprehensive technical documentation covering every engineering decision in the RAG system.

## Table of Contents

1. [System Overview](#system-overview)
2. [Transcript Ingestion](#transcript-ingestion)
3. [Semantic Chunking](#semantic-chunking)
4. [Embedding Strategy](#embedding-strategy)
5. [Vector Database](#vector-database)
6. [Hybrid Retrieval](#hybrid-retrieval)
7. [Approximate Nearest Neighbor Search](#approximate-nearest-neighbor-search)
8. [Query Rewriting](#query-rewriting)
9. [MMR Reranking](#mmr-reranking)
10. [Context Packing](#context-packing)
11. [Prompt Building](#prompt-building)
12. [Response Generation](#response-generation)
13. [Caching Strategy](#caching-strategy)
14. [Observability](#observability)
15. [Performance Optimization](#performance-optimization)
16. [Reliability Engineering](#reliability-engineering)
17. [Complexity Analysis](#complexity-analysis)
18. [Scalability Considerations](#scalability-considerations)
19. [Trade-offs and Alternatives](#trade-offs-and-alternatives)
20. [Failure Handling](#failure-handling)
21. [Deployment Architecture](#deployment-architecture)
22. [Folder Structure](#folder-structure)
23. [Future Improvements](#future-improvements)

---

## System Overview

The system transforms YouTube videos into queryable knowledge bases. Users provide a video URL, the system fetches transcripts, processes them through a RAG pipeline, and returns structured answers.

### Why this architecture?

We chose a service-oriented architecture within a monorepo to balance modularity with simplicity. Each component (embedding, retrieval, packing) is independently testable while sharing common utilities.

---

## Transcript Ingestion

Transcripts are fetched via the YouTube Transcript API or extracted from video captions.

### Design Decisions

- **Time preservation**: Each chunk maintains `startTime` and `endTime` for context
- **No audio processing**: We use YouTube's existing transcription to avoid heavy ML infrastructure
- **Fallback handling**: If transcripts aren't available, we surface this to the user immediately

### Advantages
- Zero-cost transcription for most videos
- Preserves timing information for citation

### Disadvantages
- Limited to videos with captions
- No speaker diarization

---

## Semantic Chunking

Videos are segmented into chunks using time-based boundaries (~15-30 seconds each).

### Why time-based over semantic?

Time-based chunking was chosen because:
1. **Deterministic**: Same video always produces same chunks
2. **Searchable**: Users can reference "at 2:30"
3. **Simpler**: No LLM overhead during ingestion

### Implementation

Located in `backend/src/services/chunking.service.ts`:
- Minimum 30-second chunks to capture complete thoughts
- Maximum 60-second to avoid context overload
- Overlaps handled by keeping largest semantic chunk

---

## Embedding Strategy

We use Gemini's `gemini-embedding-001` model for dense embeddings.

### Why Gemini?

- **No infrastructure**: Serverless embedding generation
- **768 dimensions**: Optimal for our token budget
- **Task-aware**: `RETRIEVAL_QUERY` and `RETRIEVAL_DOCUMENT` task types available

### Sparse Vectors

Implemented in `backend/src/utils/sparseEncoding.ts`:
- BM25-style tf-idf with position weighting
- Sparse dimension: 30,000 (Pinecone requirement)
- Only top-K terms per chunk retained

### Why not OpenAI?

OpenAI embeddings would require:
- Managing API key rotation
- Different dimension (1536) affecting Pinecone costs
- No native sparse vector support

---

## Vector Database

Pinecone serves as our vector store with hybrid (dense + sparse) search.

### Index Configuration

```json
{
  "dimension": 768,
  "sparse_dimension": 30000,
  "metric": "cosine"
}
```

### Namespace Design

Namespaces follow pattern: `{prefix}{userId}_{videoId}` (capped at 120 chars)

### Why Pinecone?

- **Managed service**: No HNSW tuning required
- **Native hybrid**: Sparse vectors without SDK upgrades
- **Filtering**: Metadata filters reduce query time
- **Scalability**: Automatic sharding

### Alternatives Considered

| Option | Rejected Because |
|--------|-----------------|
| Weaviate | More complex setup |
| Milvus | Self-hosted overhead |
| Supabase | No optimized ANN |

---

## Hybrid Retrieval

Pinecone merges dense and sparse scores natively.

### Score Combination

Pinecone uses internal normalization to combine:
- Semantic similarity (dense vectors)
- Lexical matching (sparse vectors)

### Query Flow

```
User Query
    │
    +──► Query Text ──► Sparse Vector
    │
    ▼
Dense Query Vector
    │
    +──► Pinecone Hybrid Query
    │
    ▼
Scored Results
```

### Why Native Hybrid?

Previous versions used client-side keyword scoring with hardcoded weights. Native hybrid:
- Properly normalized scores
- Single API call
- No weight tuning needed

---

## Approximate Nearest Neighbor Search

Pinecone uses HNSW (Hierarchical Navigable Small World) internally.

### HNSW Characteristics

- **Graph-based**: Logarithmic query complexity
- **Layer structure**: Entry points at multiple levels
- **Parameters**: `m` (connections), `efConstruction`, `efSearch`

### Why Not Implement HNSW?

- Pinecone manages optimal parameters
- Our scale doesn't justify custom implementation
- Maintenance overhead for minimal gains

---

## Query Rewriting

Rule-based rewriting handles follow-ups and broad queries.

### Rules Implemented

1. **Follow-up detection**: "What about X?" → includes previous context
2. **Broad query expansion**: "Tell me more" → "Explain in detail"
3. **Part-of-speech preservation**: Keeps original intent

### Why Not LLM Rewriting?

LLM rewriting would:
- Increase latency by 200-500ms
- Add $5-10/month API costs
- Provide diminishing returns for simple queries

### Rule-Based Advantages

- Sub-millisecond execution
- Deterministic behavior
- No API dependency

---

## MMR Reranking

Maximal Marginal Relevance optimizes for diversity while maintaining relevance.

### Algorithm

```
MMR = λ × sim(query, candidate) - (1-λ) × max(sim(candidate, selected))
```

Where:
- λ = 0.7 (empirically determined)
- sim = cosine similarity
- Candidate pool = Top-40 from Pinecone

### Implementation

Located in `backend/src/services/mmr.service.ts`:
- Greedy selection over candidate pool
- O(n²) complexity acceptable for n=40
- Early termination when diversity gain drops

### Why λ=0.7?

Testing showed:
- λ=0.5: Too diverse, loses relevance
- λ=0.9: Redundant chunks in results
- λ=0.7: Optimal balance for educational content

---

## Context Packing

Adjacent temporal chunks are merged to optimize token budgets.

### Packing Logic

Located in `backend/src/services/contextPacking.service.ts`:
- Gap threshold: 5 seconds between chunks
- Overlap handling: Merge if within threshold
- Token counting: Approximate (chars/4)

### Why Pack Contexts?

Without packing:
- 10 chunks ≈ 2000-4000 tokens wasted on separators
- Redundancy in adjacent content

With packing:
- Reduced token usage by 30-50%
- Cleaner context for LLM

---

## Prompt Building

Structured prompts with packed contexts and coverage awareness.

### Prompt Structure

```
System Prompt:
- Mode instruction (concise/deep/interview)
- Coverage handling rules
- Response format constraints

User Prompt:
- Question
- Video metadata
- Packed contexts
- Related topics
```

### Coverage Modes

| Mode | Description |
|------|------------|
| `none` | No relevant context found |
| `partial` | Some relevant chunks |
| `good` | Sufficient context |

---

## Response Generation

Gemini 2.5 Flash Lite generates structured JSON responses.

### Why Flash Lite?

- **Speed**: 2-5x faster than Pro models
- **Cost**: ~$0.0005 per request vs $0.002
- **Quality**: Sufficient for structured responses

### Temperature

- `0.28`: Low enough for consistency, high enough for creativity in "deep" mode

---

## Caching Strategy

Four independent LRU caches with TTL.

### Cache Hierarchy

```
Query Rewrite (15 min TTL)
    ↓
Embedding (60 min TTL)
    ↓
Retrieval (15 min TTL)
    ↓
Packing (15 min TTL)
```

### Implementation

Located in `backend/src/cache/`:
- LRU eviction using doubly-linked list + Map
- O(1) operations for get/put/delete
- Automatic TTL cleanup on access

### Why In-Memory?

- **Latency**: Sub-millisecond cache hits
- **Cost**: No Redis infrastructure
- **Consistency**: Same-node hits guaranteed

### Disadvantages

- Cache lost on restart
- No sharing across instances
- Memory capped at 1000 entries

---

## Observability

Per-stage metrics with structured logging.

### Metrics Captured

- Query rewrite latency
- Embedding API time
- Pinecone query time
- MMR computation time
- Packing time
- Total pipeline time

### Logging

Dev logs in `rag.service.ts`:
- Cache hits/misses
- Query transformations
- Error conditions

---

## Performance Optimization

### Request Deduplication

Located in `backend/src/performance/requestDeduplicator.ts`:
- Map-based pending request tracking
- Same response to concurrent identical requests
- Prevents duplicate API calls

### Parallel Execution

Located in `backend/src/performance/asyncUtils.ts`:
- Helper functions for `Promise.all`
- Configurable via `performanceConfig.ts`

---

## Reliability Engineering

### Timeout Protection

Located in `backend/src/reliability/timeout.ts`:
- Pinecone: 5000ms
- Embedding: 10000ms
- Gemini: 15000ms

### Graceful Degradation

Each stage wrapped in try-catch:

| Stage | Failure | Fallback |
|-------|---------|----------|
| Query Rewrite | Error | Original query |
| Embedding | Timeout | Keyword search |
| Pinecone | Timeout | Keyword search |
| MMR | Error | Pinecone order |
| Packing | Error | Raw chunks |
| Metrics | Error | Silent continue |

### Health Checks

Located in `backend/src/reliability/healthCheck.ts`:
- Pinecone connectivity test
- Gemini lightweight ping
- Cache memory pressure check

---

## Complexity Analysis

| Operation | Complexity | Explanation |
|-----------|------------|-------------|
| Embedding | O(n) | n = chunk count |
| Sparse encoding | O(m) | m = chunk length |
| Pinecone query | O(log n) | HNSW search |
| MMR | O(k²) | k = candidate count (40) |
| Context packing | O(m) | m = chunks |
| Deduplication | O(1) | Map lookup |

---

## Scalability Considerations

### Horizontal Scaling

- **Stateless**: Services are query-scoped
- **Cache limitation**: In-memory cache per instance
- **Redis needed**: For multi-instance deployments

### Bottlenecks

1. **Gemini API**: Rate limiting under high load
2. **Pinecone**: Namespace contention (120 char limit)
3. **Memory**: Large videos consume RAM for chunks

### Mitigation

- Request deduplication reduces redundant calls
- Cache hit rates reduce API load
- Timeout prevents cascade failures

---

## Trade-offs and Alternatives

### Embedding Model

| Model | Chosen? | Reason |
|-------|---------|--------|
| Gemini | ✅ | Serverless, 768 dim |
| OpenAI | ❌ | Higher cost, 1536 dim |
| Local (nomic-ai) | ❌ | Setup complexity |

### Caching Strategy

| Strategy | Chosen? | Reason |
|----------|---------|--------|
| In-memory LRU | ✅ | Zero latency |
| Redis | ❌ | Not justified at current scale |
| DynamoDB | ❌ | Too slow for cache |

### Retry Policy

| Strategy | Chosen? | Reason |
|----------|---------|--------|
| Exponential backoff | ✅ | Standard reliability pattern |
| Circuit breaker | ❌ | Overkill for current scale |
| Rate limiting | ❌ | Handled by Pinecone/Gemini |

---

## Failure Handling

### Error Categories

1. **Transient**: Network timeouts, 5xx errors
2. **Permanent**: Invalid requests, 4xx errors
3. **Unknown**: Unhandled exceptions

### Retry Logic

Located in `backend/src/reliability/retry.ts`:
- Backoff: 100ms → 200ms → 400ms
- Max 3 attempts
- Only for transient errors

---

## Deployment Architecture

```
┌─────────────┐
│   Client    │
└─────────────┘
       │
       ▼
┌─────────────┐
│  Frontend   │
│  (Vite)     │
└─────────────┘
       │
       ▼
┌─────────────┐
│  Backend    │
│  (Express)  │
│  (Node.js)  │
└─────────────┘
       │
    ┌──┴──┬─────────┐
    │     │         │
    ▼     ▼         ▼
Pinecone Gemini   PostgreSQL
         (Prisma)
```

### Single Instance

Currently single-region deployment with:
- No load balancer
- No auto-scaling
- Single Pinecone index

---

## Folder Structure

```
backend/src/
├── cache/              # LRU cache implementation
│   ├── lruCache.ts
│   ├── cacheKeys.ts
│   └── cacheManager.ts
├── performance/        # Optimization utilities
│   ├── asyncUtils.ts
│   ├── requestDeduplicator.ts
│   └── performanceConfig.ts
├── reliability/        # Error handling and timeouts
│   ├── errors.ts
│   ├── timeout.ts
│   ├── retry.ts
│   └── healthCheck.ts
├── services/
│   ├── gemini/         # Gemini integration
│   ├── mmr.service.ts  # MMR reranking
│   ├── rag.service.ts  # Core RAG orchestration
│   └── ...
└── utils/
    └── sparseEncoding.ts
```

---

## Future Improvements

### Short Term

1. **Redis caching**: For multi-instance deployments
2. **Streaming responses**: WebSocket support for long generations
3. **Batch embedding**: Parallelize video processing

### Long Term

1. **Multi-modal**: Image/video frame extraction
2. **Speaker labels**: Audio processing for attribution
3. **Cross-video search**: Playlist-level retrieval
4. **Custom embedding**: Domain-specific models