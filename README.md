# YT StudyFlow

A production-grade RAG system for YouTube video content analysis with intelligent retrieval, context packing, and Groq AI tutor final answer generation.

<img width="1421" height="673" alt="image" src="https://github.com/user-attachments/assets/5a6c657b-7e89-4bbc-8325-dd6a1f6b21cd" />


## Overview

YT StudyFlow transforms YouTube videos into interactive study companions. Upload a video URL, and the system automatically processes transcripts, generates Gemini embeddings, performs Pinecone vector retrieval, and uses **Groq** to generate natural, grounded educational responses presented in a clean AI tutor interface.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  YouTube    │────▶│  Transcript   │────▶│ Semantic     │
│  Video      │     │  Ingestion    │     │ Chunking     │
└─────────────┘     └──────────────┘     └──────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Gemini     │◀───│ Dense + Sparse │────▶│  Pinecone    │
│ Embedding   │     │  Embeddings   │     │  Vector DB   │
└─────────────┘     └──────────────┘     └──────────────┘
                                                │
                                                ▼
                                        ┌──────────────┐
                                        │ Query        │
                                        │ Processing   │
                                        │ (Rewrite)    │
                                        └──────────────┘
                                                │
                                                ▼
                                        ┌──────────────┐
                                        │ Hybrid       │
                                        │ Retrieval    │
                                        └──────────────┘
                                                │
                                                ▼
                                        ┌──────────────┐
                                        │ MMR          │
                                        │ Reranking    │
                                        └──────────────┘
                                                │
                                                ▼
                                        ┌──────────────┐
                                        │ Context      │
                                        │ Packing      │
                                        └──────────────┘
                                                │
                                                ▼
                                        ┌──────────────┐
                                        │ Groq LLM     │
                                        │ Generation   │
                                        └──────────────┘
                                                │
                                                ▼
                                        ┌──────────────┐
                                        │ Clean AI     │
                                        │ Tutor UI     │
                                        └──────────────┘
```

## Features

- **Gemini Dense Embeddings**: High-dimensional embeddings (`gemini-embedding-001`) for semantic search
- **Pinecone Vector Search**: Scalable vector index retrieval with adaptive-k logic
- **Groq Final Answer Generation**: Powered by fast, production Groq models (`openai/gpt-oss-20b`)
- **Dual Knowledge Coverage**: Uses transcript evidence when available, supplemented by general model knowledge when absent (without false transcript attribution)
- **MMR Reranking**: Diversity-aware selection preventing redundant context
- **Context Packing**: Time-aware chunk merging to optimize token budgets
- **Clean AI Tutor UI**: Natural response presentation free of debug labels, similarity percentages, or forced multi-card collapsible headers
- **Compact Timestamp Sources**: Sleek `Lecture · 2:14` timestamp chips with seek-to-video capabilities
- **Multi-Level Caching**: Query rewrite, embedding, retrieval, and packing caches
- **Observability**: Detailed per-stage dev logs without vector float array dumps

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| Embeddings | Google Gemini (`gemini-embedding-001`) |
| Vector DB | Pinecone |
| Answer LLM | Groq (`openai/gpt-oss-20b`) |
| Backend | Express.js |
| Database | Prisma (PostgreSQL / Supabase) |
| Caching | In-memory LRU |

## RAG Pipeline

The retrieval and generation pipeline follows a multi-stage architecture:

1. **Transcript Processing**: Videos are split into semantic chunks preserving time boundaries
2. **Embedding Generation**: Gemini creates dense vectors for transcript chunks
3. **Pinecone Indexing**: Embedded chunks stored in Pinecone vector index
4. **Query Rewriting**: Follow-up questions expanded with context
5. **Vector Search**: Relevant candidates retrieved from Pinecone
6. **MMR Reranking**: Candidates reranked for optimal relevance and diversity
7. **Context Packing**: Relevant transcript chunks packed with timestamp metadata
8. **Groq Generation**: System-instructed Groq model generates direct, clear AI tutor response
9. **Clean UI Rendering**: Clean Markdown answer with compact timestamp chips

## Installation

```bash
# Clone repository
git clone https://github.com/3305infinity/YT-StudyFlow.git
cd YT-StudyFlow

# Install backend
cd backend
npm install

# Install frontend
cd ..
npm install
```

## Environment Variables

Create `backend/.env`:

```env
# Required Services
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=yt-studyflow
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-20b

# Database & Auth
DATABASE_URL=your_postgresql_url
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
ALLOW_DEV_AUTH=true
```

## Usage

```bash
# Development
npm run dev          # Runs frontend and backend dev servers

# Backend only
cd backend
npm run dev

# Production build
npm run build
```

## Engineering Decisions

| Decision | Rationale |
|----------|-----------|
| Gemini Embeddings + Pinecone | Accurate vector space retrieval over large transcript datasets |
| Groq Final Answer Generator | Sub-second inference speed for natural conversational responses |
| Optional Transcript Coverage | Allows the AI tutor to answer general questions when transcript coverage is missing |
| Compact Source Chips | Non-intimidating timestamp references (`Lecture · 2:14`) with direct video seek |

## Limitations

- No Redis support (in-memory only)
- No distributed rate limiting
- No streaming responses
- Single-region deployment

## Roadmap

- [ ] Redis caching for multi-instance deployments
- [ ] Async embedding for large videos
- [ ] Streaming response support
- [ ] Multi-tenant query isolation
- [ ] Advanced query rewriting with LLM

## Contributing

1. Fork the repository
2. Create a feature branch
3. Follow existing TypeScript patterns
4. Add tests for new functionality
5. Submit pull request with description

## License

MIT License
