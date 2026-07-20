# YT StudyFlow Interview Guide

Comprehensive interview preparation guide with questions and detailed answers.

---

## Architecture (15 questions)

### 1. What is YT StudyFlow?

**Answer**: YT StudyFlow is a production-grade RAG system that transforms YouTube videos into interactive study companions. It processes video transcripts, generates embeddings, and enables semantic search with follow-up question support. The system features hybrid retrieval (dense + sparse vectors), MMR reranking, context packing, multi-level caching, request deduplication, and graceful degradation.

### 2. How would you describe the overall architecture?

**Answer**: The system follows a service-oriented architecture within a monorepo. The frontend (Vite/React) communicates with an Express backend which orchestrates: transcript ingestion → semantic chunking → embedding generation → Pinecone storage → query processing → hybrid retrieval → MMR reranking → context packing → prompt building → Gemini response generation. Each layer is independently testable with clear boundaries.

### 3. Why did you choose this architecture over a microservices approach?

**Answer**: A monorepo with modular services balances several concerns:
- **Simplicity**: Single deployment, no inter-service networking
- **Shared code**: Common utilities (types, error handling) without duplication
- **Developer experience**: Single TypeScript project with path aliases
- **Future migration path**: Services can be extracted later if needed

Microservices would add:
- Network latency between services
- Deployment complexity (20+ services for our features)
- Distributed tracing overhead
- Not justified at current scale

### 4. What are the main components of the system?

**Answer**: 
1. **Frontend**: Vite + React for user interface
2. **Backend**: Express.js with TypeScript for API handling
3. **RAG Service**: Core orchestration with caching and retrieval
4. **Pinecone Service**: Vector database client
5. **Gemini Service**: LLM integration for embeddings and generation
6. **MMR Service**: Diversity-aware reranking algorithm
7. **Cache Manager**: Four-tier LRU caching system
8. **Query Rewrite Service**: Rule-based query transformation

### 5. How do you handle concurrent requests?

**Answer**: We implemented request deduplication in `requestDeduplicator.ts`. When multiple identical requests arrive simultaneously, they share the same Promise. The deduplication key includes: userId, videoId, question, mode, and topK. This prevents:
- Duplicate embedding API calls
- Duplicate Pinecone queries
- Thundering herd problems
- Reduced API costs

### 6. What is your deployment architecture?

**Answer**: Currently single-instance deployment:
- Vite dev server for frontend (static files in production)
- Express server on Node.js for backend
- Pinecone managed service for vectors
- PostgreSQL for metadata (via Prisma)

Production deployment uses a single server; scaling would require Redis for shared caching and a load balancer.

### 7. How do you handle errors in the system?

**Answer**: Multi-layered error handling:
- **Per-stage try-catch**: Each pipeline stage (query rewrite, embedding, retrieval, MMR, packing, metrics) wrapped independently
- **Graceful degradation**: Failures fall back to simpler approaches (keyword search for API failures)
- **Error classification**: Transient vs permanent errors via `isTransientError()` in errors.ts
- **Structured logging**: All failures logged with context for debugging

### 8. How do you monitor system health?

**Answer**: Health checks in `healthCheck.ts`:
- Pinecone connectivity via `describeIndexStats()`
- Gemini health via lightweight generation test
- Cache memory pressure monitoring (entries > 1000)
- Overall status: healthy/degraded/unhealthy based on component states

### 9. What is your caching strategy?

**Answer**: Four-tier in-memory LRU cache:
1. **Query rewrite cache**: 15 min TTL, high hit rate for similar questions
2. **Embedding cache**: 60 min TTL, expensive to compute
3. **Retrieval cache**: 15 min TTL, network-bound operation
4. **Packing cache**: 15 min TTL, pure function output

Each cache uses O(1) operations via Map + doubly-linked list.

### 10. Why in-memory cache instead of Redis?

**Answer**: In-memory was chosen for:
- **Zero-latency cache hits** (sub-millisecond vs network RTT)
- **No external dependencies** for simpler deployment
- **Consistent with single-instance deployment**

Redis would be added when:
- Multiple backend instances needed
- Cache persistence across restarts required
- Cache size exceeds available memory

### 11. How do you handle timeouts?

**Answer**: Timeout wrapper in `timeout.ts`:
- Pinecone: 5000ms (vector search is fast)
- Embedding: 10000ms (can be slow for many chunks)
- Gemini: 15000ms (LLM generation varies)

Timeout rejection doesn't cancel the underlying operation (prevents duplicate calls on retry).

### 12. What is your retry strategy?

**Answer**: Exponential backoff in `retry.ts`:
- Base delay: 100ms
- Multiplier: 2x per attempt
- Max delay: 2000ms
- Max retries: 3

Only transient errors (network timeouts, 5xx) are retried; 4xx errors are permanent failures.

### 13. How do you measure performance?

**Answer**: Per-stage latency tracking in `rag.service.ts`:
- Query rewriting time
- Embedding generation time
- Pinecone query time
- MMR computation time
- Context packing time
- Total pipeline time

Metrics logged via `retrievalMetrics.log()` when enabled.

### 14. What was the most challenging architectural decision?

**Answer**: Choosing between client-side vs Pinecone-native hybrid search. Client-side would require:
- Manual weight tuning (we used 1.0 for keyword, 2.5 for semantic)
- Two separate queries (semantic + keyword)
- Score normalization challenges

Pinecone-native required index recreation but provided:
- Single API call
- Proper score normalization
- Better performance

We chose native for production quality.

### 15. How would you scale this system horizontally?

**Answer**: Current bottlenecks:
1. In-memory cache not shared (solved: Redis)
2. Single Gemini rate limit (solved: multiple API keys + load balancing)
3. Pinecone namespace limits (solved: multiple pods)
4. PostgreSQL as single point (solved: read replicas)

Scaling steps:
1. Extract indexing to background workers
2. Add Redis for shared caching
3. Deploy multiple backend instances behind load balancer
4. Use multiple Pinecone pods per region
5. Separate read/write database connections

---

## RAG (20 questions)

### 16. What is RAG and why use it?

**Answer**: Retrieval-Augmented Generation combines vector search with LLM generation. Benefits:
- **Factuality**: LLM grounded in retrieved context
- **Source attribution**: Citations for every claim
- **Reduced hallucination**: Less confident in unverified content
- **Cost efficiency**: Embedding once, query many times

Better than fine-tuning for dynamic content.

### 17. How do you chunk transcripts?

**Answer**: Time-based chunking in semantic chunks:
- Target: 15-30 second segments
- Minimum: 30 seconds to capture complete thoughts
- Maximum: 60 seconds to avoid overload
- Preserves `startTime`/`endTime` for citations

Time-based chosen over semantic because:
- Deterministic (same video → same chunks)
- Searchable by timestamp
- Lower computational cost

### 18. What embedding model do you use?

**Answer**: Gemini `gemini-embedding-001`. Why:
- 768 dimensions (optimal for our token budget)
- Serverless (no GPU infrastructure)
- Task-aware (`RETRIEVAL_QUERY` vs `RETRIEVAL_DOCUMENT`)
- Competitive performance on retrieval benchmarks

### 19. What is hybrid retrieval?

**Answer**: Combining dense and sparse vectors in Pinecone:
- **Dense**: 768-dim Gemini embeddings (semantic meaning)
- **Sparse**: 30,000-dim BM25-style tf-idf (lexical matching)

Pinecone merges scores natively. This improves recall over dense-only search.

### 20. Why not just use keyword search?

**Answer**: Keyword search misses:
- Synonyms ("vehicle" vs "car")
- Conceptual matches ("ML" vs "machine learning")
- Context-aware queries

Dense vectors capture semantic relationships but may miss exact terms. Hybrid provides both.

### 21. What is MMR reranking?

**Answer**: Maximal Marginal Relevance selects diverse results. Formula:

```
MMR = λ × sim(query, candidate) - (1-λ) × max(sim(candidate, selected))
```

Where λ=0.7 balances relevance vs diversity. Prevents returning 10 nearly-identical chunks.

### 22. Why λ=0.7 for MMR?

**Answer**: Tested values:
- λ=0.5: Too diverse, loses relevance (relevant chunks deprioritized)
- λ=0.9: Too redundant (similar chunks returned)
- λ=0.7: Optimal balance for educational content

Educational content benefits from some diversity to cover different aspects of a topic.

### 23. How do you generate sparse vectors?

**Answer**: BM25-style tf-idf in `sparseEncoding.ts`:
1. Extract terms with frequency weighting
2. Apply position boosting (earlier terms weighted higher)
3. Convert to sparse format (indices + values)
4. Pad to 30,000 dimensions (Pinecone requirement)

### 24. What is context packing?

**Answer**: Merging adjacent temporal chunks in `contextPacking.service.ts`:
- Gap threshold: 5 seconds between chunks
- Merges if time difference < threshold
- Reduces token count by 30-50%
- Preserves context continuity

### 25. Why pack contexts instead of returning raw chunks?

**Answer**: Raw chunks cause:
- Redundant context in adjacent chunks
- Wasted tokens on separators
- Fragmented information for LLM

Packed contexts provide:
- Cohesive information blocks
- Reduced token usage
- Better LLM comprehension

### 26. How do you handle follow-up questions?

**Answer**: Rule-based in `queryRewrite.service.ts`:
- Detects "what about X" patterns
- Expands with previous context
- No LLM overhead (sub-ms vs 500ms+)

Example: "What about the algorithm?" → "What about the algorithm mentioned earlier?"

### 27. What prompt structure do you use?

**Answer**: Structured with system + user:
- System: Mode instruction, coverage rules, response format
- User: Question, video metadata, packed contexts
- Coverage-aware: Different instructions for none/partial/good coverage

### 28. Why Gemini Flash Lite instead of Pro?

**Answer**: Cost-performance tradeoff:
- Flash Lite: ~$0.0005/request, 2-5x faster
- Pro: ~$0.002/request, slower but higher quality

For structured responses, Flash Lite quality is sufficient.

### 29. How do you ensure response quality?

**Answer**: 
- Coverage analysis determines if context is sufficient
- Temperature 0.28 for consistency
- JSON schema validation
- Fallback parsing for malformed responses
- Structured logging for quality monitoring

### 30. What happens when context exceeds token limits?

**Answer**: 
1. MMR selects top-K candidates (configurable)
2. Context packing merges adjacent chunks
3. Still may exceed limits for large K
4. Future: Dynamic K adjustment based on prompt length

### 31. How do you evaluate retrieval quality?

**Answer**: In `retrievalMetrics.ts`:
- Per-stage latency tracking
- Chunk count and similarity scores
- Coverage analysis (none/partial/good)
- Prompt token count

For production: A/B testing on answer quality would be added.

### 32. What is your search index structure?

**Answer**: Pinecone namespace: `{prefix}{userId}_{videoId}`. Each video has its own namespace for:
- Easy deletion (entire namespace)
- User isolation
- Query performance (smaller index)

### 33. How do you handle deleted videos?

**Answer**: `pineconeService.deleteVideo()`:
- Deletes entire namespace
- Cache invalidated via `cacheManager.invalidateVideo()`
- Timestamp-based cleanup for missed entries

### 34. What's your retrieval recall strategy?

**Answer**: Hybrid + MMR + Packing:
1. Hybrid catches semantic + lexical matches
2. MMR ensures diversity in results
3. Packing preserves context continuity
4. Keyword fallback ensures availability

### 35. How do you prevent retrieval degradation?

**Answer**: Multiple strategies:
- Cache layer for repeated queries
- Fallback to keyword search on timeout
- Health checks for proactive monitoring
- Metrics for quality tracking

---

## Embeddings & Pinecone (15 questions)

### 36. How do embeddings work?

**Answer**: Gemini embeddings map text to 768-dimensional vectors where:
- Similar meanings → nearby vectors
- Cosine similarity measures closeness
- Task-specific fine-tuning (RETRIEVAL_QUERY)

### 37. What's the difference between dense and sparse embeddings?

**Answer**:
- **Dense**: 768 dimensions, all values non-zero, captures semantics
- **Sparse**: 30,000 dimensions, mostly zeros, captures exact terms

Dense handles synonyms; sparse handles exact matches.

### 38. How does Pinecone store vectors?

**Answer**: HNSW (Hierarchical Navigable Small World) graph:
- Layers of connectivity
- Logarithmic search complexity
- Configurable parameters (m, efConstruction, efSearch)

Managed by Pinecone; we just configure index settings.

### 39. What's HNSW and why is it important?

**Answer**: Hierarchical Navigable Small World graphs provide:
- **Logarithmic search**: O(log n) vs O(n) brute force
- **Layered navigation**: Fast entry point selection
- **Trade-off**: Recall vs speed via efSearch parameter

Pinecone manages optimal HNSW parameters.

### 40. Why cosine similarity?

**Answer**: Cosine is:
- **Magnitude-invariant**: Long vs short documents comparable
- **Standard for embeddings**: Most models use cosine training
- **Intuitive**: 1 = identical, 0 = orthogonal, -1 = opposite

### 41. How do you handle vector dimensionality?

**Answer**: 768 dimensions (Gemini embedding output). Pinecone configuration:
- dimension: 768
- sparse_dimension: 30000 (max for Pinecone)

### 42. What's your upsert strategy?

**Answer**: Batch upsert in `pinecone.service.ts`:
- All chunks upserted in single namespace
- Sparse values included if indices present
- Metadata includes text preview (1000 chars max)

### 43. How do you query Pinecone?

**Answer**: Hybrid query with:
- Query embedding (dense)
- Sparse vector (from query text)
- Top-K=40 for candidate pool
- Namespace filter on videoId

### 44. What's your namespace strategy?

**Answer**: Per-video namespaces: `{prefix}{userId}_{videoId}`. Benefits:
- Easy cleanup (delete namespace)
- User isolation
- Query performance (smaller search space)

### 45. How do you handle Pinecone rate limits?

**Answer**: 
- Request deduplication prevents duplicate queries
- Cache hits avoid API calls
- Exponential backoff on rate limit errors
- Future: Queue-based rate limiting

### 46. What metadata do you store?

**Answer**: 
- text (1000 char preview)
- title (200 char video title)
- startTime, endTime (timestamps)
- videoId, playlistId (filters)

### 47. How do you optimize Pinecone costs?

**Answer**:
- Single embedding per query (cached)
- Candidate pool (40) not full scan
- In-memory cache for frequent queries
- Compact metadata storage

### 48. What's your vector update strategy?

**Answer**: Full re-index on transcript update (in `indexVideo`):
- Delete namespace
- Upsert all chunks
- Cache invalidated

No partial updates because transcripts can change substantially.

### 49. How do you handle vector deletion?

**Answer**: `pineconeService.deleteVideo()`:
- Delete entire namespace via `deleteAll()`
- Cache invalidation
- PostgreSQL metadata cleanup (via Prisma)

### 50. What's your index sizing strategy?

**Answer**: Currently single pod. Would scale to:
- Multiple pods for high traffic
- Pod type: s1 (standard)
- Replication for availability

---

## Performance Engineering (15 questions)

### 51. What caching strategy do you use?

**Answer**: Four-tier in-memory LRU:
1. Query rewrite (15 min TTL)
2. Embedding (60 min TTL)
3. Retrieval (15 min TTL)
4. Packing (15 min TTL)

### 52. How does LRU eviction work?

**Answer**: In `lruCache.ts`:
- Doubly-linked list for access order
- Map for O(1) lookups
- On access: move to head
- On eviction: remove from tail
- O(1) for get/put/delete

### 53. What's your cache key strategy?

**Answer**: Deterministic keys in `cacheKeys.ts`:
- Query rewrite: `qr:{hash(content)}`
- Embedding: `emb:{hash(query)}`
- Retrieval: `ret:{videoId}:{query}:{playlistId}`
- Packing: `pack:{videoId}:{sortedChunkIds}`

### 54. How do you handle cache stampede?

**Answer**: Request deduplication prevents it:
- Only one API call per unique request
- Other waiters get same Promise
- No parallel redundant work

### 55. What's your timeout strategy?

**Answer**: Service-specific timeouts:
- Pinecone: 5000ms (fast operation)
- Embedding: 10000ms (can be slow)
- Gemini: 15000ms (variable generation time)

### 56. How do you measure latency?

**Answer**: In `rag.service.ts`:
```typescript
const totalStart = Date.now();
// ... operation ...
const latencyMs = Date.now() - totalStart;
```

Tracked per stage and aggregated.

### 57. What's your performance bottleneck?

**Answer**: Gemini API:
- Rate limiting under load
- Variable latency
- No batch for real-time queries

Mitigation: caching + deduplication.

### 58. How do you optimize cold starts?

**Answer**: Cache warming not implemented. Would add:
- Pre-embed popular questions
- Background cache warming
- Predictive prefetching

### 59. What's your memory management?

**Answer**: LRU cache size limit (1000 entries). Memory pressure detected in health checks. Future: Redis for scaling.

### 60. How do you handle concurrent queries?

**Answer**: Request deduplication:
- Map of pending promises
- Same key = same promise
- Automatic cleanup on completion/error

### 61. What's your throughput optimization?

**Answer**: 
- Cache hits: sub-millisecond response
- Deduplication: prevents redundant work
- Parallel stages where possible
- MMR on small candidate pool (40)

### 62. How do you profile performance?

**Answer**: Manual timing with `Date.now()`:
- Per-stage latency
- Log to `retrievalMetrics.ts`
- Future: OpenTelemetry integration

### 63. What's your scaling limitation?

**Answer**: In-memory cache:
- Not shared across instances
- Lost on restart
- Memory-bounded

### 64. How do you handle request queuing?

**Answer**: No explicit queuing. Concurrency limited by:
- Node.js event loop (single-threaded)
- Gemini/Pinecone rate limits
- Cache preventing redundant work

### 65. What's your response time SLA?

**Answer**: Target:
- Cache hit: <100ms
- Cache miss: <3s
- Timeout: 5-15s (varies by stage)

---

## Reliability Engineering (15 questions)

### 66. How do you handle service failures?

**Answer**: Graceful degradation:
1. Query rewrite fails → original query
2. Embedding/Pinecone fails → keyword search
3. MMR fails → original retrieval order
4. Packing fails → raw chunks
5. Metrics fails → silent continue

### 67. What's your error classification?

**Answer**: In `errors.ts`:
- **Transient**: Network timeouts, 5xx (retryable)
- **Permanent**: 4xx, validation (not retryable)
- **Unknown**: Unhandled errors

### 68. How do you implement retries?

**Answer**: In `retry.ts`:
- Exponential backoff
- Configurable max retries (default 3)
- Only for transient errors
- Jitter not yet implemented

### 69. What's your circuit breaker strategy?

**Answer**: Not implemented. Would add for:
- Repeated failures
- Fast fail pattern
- Half-open state for testing recovery

### 70. How do you handle timeouts gracefully?

**Answer**: Timeout wrapper doesn't cancel the underlying operation. This prevents:
- Duplicate API calls on retry
- Race conditions
- Resource leaks (timers cleaned up)

### 71. What's your health check strategy?

**Answer**: In `healthCheck.ts`:
- Pinecone: describeIndexStats
- Gemini: lightweight test generation
- Cache: memory pressure check

### 72. How do you ensure data consistency?

**Answer**: 
- Cache invalidation on re-index
- Timestamp tracking for chunks
- Transactional database updates (Prisma)

### 73. What's your backup strategy?

**Answer**: 
- Pinecone: managed backups
- PostgreSQL: managed by provider
- Code: Git version control
- Cache: ephemeral (no backup needed)

### 74. How do you handle partial outages?

**Answer**: Graceful degradation:
- Pinecone down → keyword search
- Gemini down → fallback to cached responses
- Cache full → LRU eviction

### 75. What's your observability strategy?

**Answer**: 
- Structured logging via `ragDevLog`
- Per-stage latency metrics
- Error tracking with context
- Health endpoint for monitoring

### 76. How do you test failure scenarios?

**Answer**: Manual testing via:
- Timeout simulation
- Cache miss forcing
- API error injection (planned)

### 77. What's your rollback strategy?

**Answer**: Git-based:
- `git revert` for bad deployments
- Database migrations reversible
- Cache rebuild on startup

### 78. How do you handle rate limiting?

**Answer**: 
- Exponential backoff in `retry.ts`
- Cache prevents redundant calls
- Deduplication prevents parallel calls

### 79. What's your monitoring stack?

**Answer**: Currently:
- Console logs for development
- Health endpoint for liveness
- Planned: Prometheus + Grafana

### 80. How do you ensure high availability?

**Answer**: 
- Multiple service checks
- Timeout protection
- Graceful degradation
- Planned: Multi-region deployment

---

## TypeScript Implementation (10 questions)

### 81. Why TypeScript?

**Answer**: 
- Type safety prevents runtime errors
- Excellent IDE support
- Gradual typing
- Shared types between frontend/backend

### 82. What TypeScript patterns do you use?

**Answer**:
- Service objects with async methods
- Type exports for shared interfaces
- Generic utilities (`withRetry<T>`)
- Strict null checks

### 83. How do you handle async operations?

**Answer**:
- Native Promises (no async/await in utilities)
- Error boundaries per stage
- Request deduplication for concurrency

### 84. What's your error handling pattern?

**Answer**:
- `try/catch` per stage
- Typed errors with categories
- Re-throw after logging
- Never fail on metrics errors

### 85. How do you manage dependencies?

**Answer**:
- Direct imports
- No circular dependencies
- Utility modules for shared logic
- Service composition

### 86. What's your configuration pattern?

**Answer**:
- Environment variables via `dotenv`
- Config objects per module
- Defaults in code
- Runtime configuration for performance

### 87. How do you test the system?

**Answer**: 
- Manual testing currently
- TypeScript compilation catches errors
- Integration tests planned

### 88. What's your module structure?

**Answer**:
- Feature-based folders
- Barrel exports for services
- Clear separation: cache, performance, reliability, services

### 89. How do you handle environment differences?

**Answer**:
- `env.ts` for configuration
- Different configs for dev/prod
- Type-safe environment access

### 90. What's your build process?

**Answer**:
- `tsc` for compilation
- `tsx` for development
- `vite` for frontend bundling

---

## Production Trade-offs (10 questions)

### 91. Cost vs Performance trade-offs?

**Answer**: 
- Gemini Flash Lite (cost-effective) vs Pro (higher quality)
- In-memory cache (free) vs Redis (scalable)
- Single instance (simple) vs Multi-instance (complex)

### 92. Consistency vs Availability?

**Answer**: 
- Cache can be stale (eventual consistency)
- System available during partial outages
- Strong consistency for user data (PostgreSQL)

### 93. Latency vs Throughput?

**Answer**:
- Caching improves both
- Deduplication improves throughput at slight latency cost
- MMR on small pool balances both

### 94. Memory vs Performance?

**Answer**:
- LRU cache uses memory for speed
- Cache size capped at 1000 entries
- Future: Redis for memory offloading

### 95. Simplicity vs Features?

**Answer**:
- Started simple (keyword search)
- Added features incrementally
- Each feature adds complexity

### 96. Accuracy vs Speed?

**Answer**:
- MMR improves accuracy (diversity)
- Hybrid improves accuracy (recall)
- Caching improves speed
- Trade-off: λ=0.7 balances both

### 97. What would you change for scale?

**Answer**:
1. Redis for shared caching
2. Background workers for indexing
3. Multi-region deployment
4. Circuit breakers
5. Streaming responses

### 98. What's your biggest technical debt?

**Answer**:
- No automated tests
- Single instance limits
- No streaming support
- Manual health checks

### 99. What's not implemented yet?

**Answer**:
- Redis caching
- Streaming responses
- Multi-region deployment
- Automated testing
- Distributed tracing

### 100. What makes this production-grade?

**Answer**:
- Timeout protection
- Graceful degradation
- Observability (metrics + logs)
- Caching
- Deduplication
- Health checks
- Error boundaries
- Type safety

---

## Additional Questions

### 101. How do you handle large videos?

**Answer**: Currently all chunks processed in memory. For large videos:
- Stream processing
- Background indexing
- Chunk pagination

### 102. What's your data retention policy?

**Answer**: Videos retained until user deletes. Could add:
- TTL for inactive videos
- Cost-based cleanup
- User-configurable retention

### 103. How do you prevent prompt injection?

**Answer**: 
- No user content in system prompt
- Sanitized context formatting
- LLM instruction hierarchy
- Future: Input validation layer

### 104. What's your security model?

**Answer**:
- API keys in environment
- Clerk for authentication
- Input validation (planned)
- Rate limiting (express-rate-limit)