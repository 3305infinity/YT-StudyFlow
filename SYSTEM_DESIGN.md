# YT StudyFlow System Design

High-level and low-level design documentation with sequence diagrams.

---

## High-Level Design

### System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                        YT StudyFlow System                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────────┐ │
│  │  Frontend    │    │   Backend    │    │   External APIs     │ │
│  │  (Browser)   │◀──▶│  (Express)   │◀──▶│  ┌──────────────┐   │ │
│  └──────────────┘    └──────────────┘    │  │  Pinecone    │   │ │
│         │                   │           │  └──────────────┘   │ │
│         │                   │           │  ┌──────────────┐   │ │
│         ▼                   ▼           │  │  Gemini API  │   │ │
│  ┌──────────────┐    ┌──────────────┐    │  └──────────────┘   │ │
│  │  Vite Dev    │    │  Routes      │    │  ┌──────────────┐   │ │
│  │  Server      │    │  Controllers │    │  │  YouTube API │   │ │
│  └──────────────┘    └──────────────┘    │  └──────────────┘   │ │
│         │                   │           └─────────────────────┘ │
│         │                   │                                  │
│         │                   ▼                                  │
│         │            ┌──────────────┐                         │
│         │            │  RAG Service  │                         │
│         │            │              │                         │
│         │            │  Cache       │                         │
│         │            │  Query Rewrite│                        │
│         │            │  Embedding    │                         │
│         │            │  Retrieval    │                         │
│         │            │  MMR         │                         │
│         │            │  Packing      │                         │
│         │            └──────────────┘                         │
│         │                   │                                  │
│         │                   ▼                                  │
│         │            ┌──────────────┐                         │
│         │            │  PostgreSQL  │                         │
│         │            │  (Prisma)    │                         │
│         │            └──────────────┘                         │
│         │                                                      │
└─────────┴────────────────────────────────────────────────────────┘
```

---

## Low-Level Design

### Component Details

#### Backend Services

- **RAG Service**: Orchestrates retrieval pipeline
- **Embedding Service**: Gemini integration for dense vectors
- **Pinecone Service**: Vector storage and querying
- **Cache Manager**: Four-tier LRU caching
- **Query Rewrite Service**: Rule-based query transformation
- **MMR Service**: Maximal Marginal Relevance reranking
- **Context Packing Service**: Adjacent chunk merging

#### Data Flow

Each request follows this path:
1. Validate request parameters
2. Check deduplication cache
3. Rewrite query if needed
4. Generate/fetch embedding
5. Query Pinecone
6. Apply MMR reranking
7. Pack contexts
8. Build prompt
9. Generate response
10. Log metrics

---

## Sequence Diagrams

### Request Lifecycle

```mermaid
sequenceDiagram
    participant Client
    participant Backend
    participant Cache
    participant Gemini
    participant Pinecone

    Client->>Backend: POST /chat {question, videoId}
    Backend->>Cache: Check query rewrite cache
    alt Cache miss
        Backend->>Gemini: Generate embedding
        Gemini-->>Backend: Return embedding
        Backend->>Cache: Store embedding
    end
    Backend->>Pinecone: Query with hybrid vectors
    Pinecone-->>Backend: Top-40 candidates
    Backend->>Backend: MMR rerank to Top-10
    Backend->>Backend: Pack adjacent contexts
    Backend->>Gemini: Generate response
    Gemini-->>Backend: Structured JSON
    Backend-->>Client: Response
```

### Video Indexing Pipeline

```mermaid
sequenceDiagram
    participant User
    participant Backend
    participant Gemini
    participant Pinecone

    User->>Backend: POST /index {videoId, transcript}
    Backend->>Backend: Semantic chunking
    Backend->>Gemini: Batch embed chunks
    Gemini-->>Backend: Dense embeddings
    Backend->>Backend: Generate sparse vectors
    Backend->>Pinecone: Upsert vectors
    Pinecone-->>Backend: Acknowledge
    Backend-->>User: Indexed
```

### Caching Flow

```mermaid
flowchart LR
    A[Query] --> B{Query Rewrite Cache}
    B -- Hit --> C[Rewritten Query]
    B -- Miss --> D[Rewrite Query]
    D --> E[Store in Cache]
    E --> C
    C --> F{Embedding Cache}
    F -- Hit --> G[Embedding]
    F -- Miss --> H[Gemini Embed]
    H --> I[Store in Cache]
    I --> G
    G --> J{Retrieval Cache}
    J -- Hit --> K[Candidates]
    J -- Miss --> L[Pinecone Query]
    L --> M[Store in Cache]
    M --> K
```

### Vector Database Flow

```mermaid
flowchart LR
    A[Chunk Text] --> B[Gemini Embed]
    B --> C[Dense Vector]
    A --> D[Sparse Encode]
    D --> E[Sparse Vector]
    C --> F[Pinecone Upsert]
    E --> F
    G[Query Text] --> H[Gemini Embed]
    H --> I[Query Vector]
    G --> J[Sparse Query]
    J --> K[Pinecone Query]
    I --> K
    K --> L[Scored Results]
```

---

## Backend Architecture

### Route Structure

```
src/routes/
├── chat.ts           # /chat endpoint
├── video.ts          # Video management
├── index.ts          # Route aggregation
└── health.ts       # Health checks
```

### Service Layer

```
src/services/
├── rag.service.ts         # Core orchestration
├── embedding.service.ts   # Gemini embedding wrapper
├── pinecone.service.ts    # Vector DB client
├── mmr.service.ts         # Reranking algorithm
├── contextPacking.service.ts # Context merging
├── queryRewrite.service.ts # Query transformation
├── promptBuilder.service.ts # Prompt construction
├── gemini/               # Gemini HTTP integration
└── metrics.service.ts    # Observability
```

### Caching Layer

```
src/cache/
├── lruCache.ts      # O(1) cache implementation
├── cacheKeys.ts     # Key generation utilities
└── cacheManager.ts  # Cache orchestration
```

### Performance Layer

```
src/performance/
├── requestDeduplicator.ts # Concurrency dedup
├── asyncUtils.ts        # Parallel helpers
└── performanceConfig.ts   # Configuration
```

### Reliability Layer

```
src/reliability/
├── errors.ts      # Error types
├── timeout.ts     # Request timeouts
├── retry.ts       # Retry logic
└── healthCheck.ts # Health monitoring
```

---

## Frontend Architecture

### Component Structure

```
src/
├── components/
│   ├── ChatView.tsx       # Main chat interface
│   ├── MessageList.tsx    # Message display
│   └── SourceList.tsx     # Citation display
├── lib/
│   └── api.ts             # API client
└── routes/
    ├── Root.tsx           # Main route
    └── Video.tsx          # Video processing
```

---

## Retrieval Pipeline

### Detailed Flow

```mermaid
graph TD
    A[User Question] --> B{Query Rewrite Cache}
    B -->|Hit| C[Rewritten Query]
    B -->|Miss| D[Query Rewrite Service]
    D --> C
    C --> E{Embedding Cache}
    E -->|Hit| F[Query Embedding]
    E -->|Miss| G[Gemini embedQuery]
    G --> F
    F --> H{Pinecone}
    H --> I[Sparse + Dense Query]
    I --> J[Top 40 Candidates]
    J --> K[MMR Rerank]
    K --> L[Top 10 Selected]
    L --> M{Context Pack Cache}
    M -->|Hit| N[Packed Contexts]
    M -->|Miss| O[Pack Adjacent Chunks]
    O --> N
    N --> P[Prompt Builder]
    P --> Q[Gemini Generate]
    Q --> R[Structured Response]
```

### Component Interactions

```mermaid
graph LR
    subgraph "Request Processing"
        A[Request] --> B[RAG Service]
        B --> C[Cache Manager]
        B --> D[Query Rewrite]
        D --> E[Embedding Service]
        E --> F[Gemini]
        B --> G[Pinecone Service]
        G --> H[Pinecone]
    end

    subgraph "Post-Processing"
        I[MMR Service] --> J[Context Pack]
        J --> K[Gemini Service]
        K --> L[Gemini]
    end

    subgraph "Observability"
        M[Metrics Service]
        N[RAG Dev Log]
    end

    B --> I
    B --> M
    C -.-> N
```

---

## Deployment Diagram

```mermaid
graph TD
    A[Internet] --> B[Vite Dev Server<br/>localhost:5173]
    B --> C[Express Server<br/>localhost:3001]
    C --> D[Pinecone<br/>pinecone.com]
    C --> E[Gemini API<br/>generativelanguage.googleapis.com]
    C --> F[PostgreSQL<br/>localhost:5432]
```

### Production Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (Optional)                  │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Frontend    │    │   Backend    │    │   Backend    │
│  (Static)    │    │  (Instance 1)│    │  (Instance 2)│
└──────────────┘    └──────────────┘    └──────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   Pinecone        │
                    │   (Managed)       │
                    └─────────┬─────────┘
                              │
                    ┌─────────┴─────────┐
                    │   PostgreSQL      │
                    │   (Managed)       │
                    └───────────────────┘
```

---

## Scaling Strategy

### Vertical Scaling

- Increase Node.js heap for large video processing
- Larger Pinecone pod for higher QPS
- Connection pooling for Gemini API

### Horizontal Scaling

Current limitations:
- In-memory cache not shared
- No request routing
- Single PostgreSQL instance

To scale horizontally:
1. Add Redis for shared caching
2. Add load balancer
3. Separate worker process for indexing
4. Database read replicas

### Scaling Recommendations

| Metric | Current | Scale Trigger | Action |
|--------|---------|---------------|--------|
| QPS | <10 | >100 QPS | Add instances + Redis |
| Video length | <60min | >2hr | Async processing |
| Cache hit rate | >50% | <30% | Increase cache size |
| Response time | <3s | >5s | Optimize pipeline |