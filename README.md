# YT StudyFlow

Chrome extension that turns YouTube lectures into an **AI study workspace** with Pinecone-backed RAG, cited answers, notes, quizzes, flashcards (SM-2), and learning analytics.

---

## What this project does

- Extracts and cleans YouTube transcripts (extension-side)
- Builds a RAG knowledge base using Gemini embeddings + Pinecone vector search
- Answers with timestamp citations
- Generates and syncs: notes, quizzes, flashcards, and chat history
- Tracks learning analytics (progress + confusion signals)

---

## Repo structure

- **Chrome extension (UI):** `src/` (Vite + React) + content scripts
- **Backend API:** `backend/` (Express + Prisma)
  - Gemini (generation + embeddings)
  - Pinecone (indexing + retrieval)
  - Postgres (persistence + sync)
- **Hosted auth app (optional):** `web/` (Clerk sign-in)
- **Icons & static assets:** `public/`

---


> **Project path:** `second_aprt/yt-studyflow`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Chrome Extension (React + Dexie)                               │
│  • Transcript extraction (YouTube captions / InnerTube)         │
│  • Chunk metadata cache (IndexedDB — no local vectors)          │
│  • Chat, Notes, Quiz, Flashcards, Study, Analytics UI           │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP via background service worker
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Express Backend (backend/)                                     │
│  • Gemini generateContent + gemini-embedding-001                  │
│  • Pinecone vector upsert / query (cosine similarity)           │
│  • Hybrid retrieval (keyword + semantic)                        │
│  • Postgres persistence (notes, flashcards, sync)                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
        Google Gemini API           Pinecone Index
```

### RAG Pipeline

```
Transcript Extraction (extension)
        ↓
Transcript Cleaning + Chunking (extension)
        ↓
POST /api/rag/index → EmbeddingService (Gemini)
        ↓
PineconeService.upsert (metadata: videoId, playlistId, title, text, timestamps)
        ↓
User Query
        ↓
POST /api/rag/retrieve → embed query (Gemini) + Pinecone query (Top-K, cosine)
        ↓
RetrievalService merges keyword + semantic scores
        ↓
PromptBuilder → Gemini response → CitationService (timestamps)
```

### Backend Services

| Service | Responsibility |
|---------|----------------|
| `embedding.service.ts` | Gemini embedding generation (document + query) |
| `pinecone.service.ts` | Vector upsert, query, namespace, metadata filtering |
| `retrieval.service.ts` | Hybrid keyword + semantic merge & rank |
| `rag.service.ts` | Pipeline orchestrator (index + retrieve) |
| `promptBuilder.service.ts` | Chat / tutor prompt assembly |
| `citation.service.ts` | Timestamp citations from retrieved chunks |
| `gemini.service.ts` | Text generation |

### Pinecone Integration

- **Index:** configured via `PINECONE_INDEX` (default `yt-studyflow`)
- **Namespace:** `{PINECONE_NAMESPACE_}{userId}_{videoId}` — isolates vectors per user/video
- **Metric:** cosine similarity (Pinecone default for most indexes)
- **Metadata per vector:**
  - `videoId`, `playlistId`, `title`, `text`, `startTime`, `endTime`
- **Filtering:** queries can filter by `videoId` and `playlistId` metadata
- **Top-K:** configurable per request (chat uses 14 by default)

### Authentication (temporarily disabled)

Clerk auth code is **preserved but bypassed**. Set `AUTH_DISABLED=false` in backend and extension `auth.config.ts` to re-enable.

Files kept intact with `TODO:` markers:
- `backend/src/middleware/auth.ts`
- `src/lib/api/auth.ts`, `auth.store.ts`
- `web/` hosted Clerk sign-in app
- `public/auth/callback.html`

---

## Local Development

### Prerequisites

- Node 18+
- [Gemini API key](https://aistudio.google.com/apikey)
- [Pinecone account](https://www.pinecone.io/) + index (dimension **768** for `gemini-embedding-001`)
- Optional: Supabase Postgres for cloud sync

### Multi-video revision (SM-2 spaced repetition)

- Flashcards generated **per video** or **across an entire playlist**
- Uses **SM-2** spaced repetition scheduling inside the **Revision** tab
- Lets you generate course-scale decks after indexing multiple lectures

---

### Agentic study mode (“Study” tab)

Workflow (high-level):

1. Retrieves relevant sections across indexed playlist videos (**vector + keyword**)
2. Builds a **learning path** (watch → notes → quiz → flashcards → review)
3. Tracks **mastery %** as you complete steps
4. Connects steps back to lecture context (timestamps + other tabs)

---

### Learning analytics (confusion + progress heatmap)

- Monitors key player behaviors (rewind/seek/pause patterns)
- Detects **confusion zones** and shows them as a **progress/heatmap overlay**
- Provides actionable study signals (e.g., which parts you keep returning to)

---
<img width="2873" height="1442" alt="image" src="https://github.com/user-attachments/assets/0607fb62-fa0a-4410-8da2-cd839dc43614" />

<img width="748" height="1336" alt="image" src="https://github.com/user-attachments/assets/f6168b06-63ce-44ba-b323-8e75d1c796e1" />

<img width="730" height="1322" alt="image" src="https://github.com/user-attachments/assets/ab08dce9-eda5-4bff-bdfc-f14800006730" />

<img width="736" height="1345" alt="image" src="https://github.com/user-attachments/assets/f592209a-a135-424f-9ec4-e0958d204132" />



## 3) Tech stack

### Frontend (extension UI)

- **TypeScript**
- **React 18**
- **Vite** + **CRXJS** (Manifest V3 build tooling)
- **Tailwind CSS** (plus CSS isolation)
- **Framer Motion** (UI animations)
- **Zustand** (client state)
- **Dexie** (IndexedDB wrapper)

### AI / retrieval

- **Google Gemini API** via `@google/generative-ai`
  - `generateContent` for chat/notes/quizzes
  - `gemini-embedding-001` for embeddings
- **Hybrid retrieval** combining embedding similarity + keyword matching

### YouTube integration

- Content-script + **Shadow DOM sidebar injection** on `youtube.com/watch`
- Captures transcript/caption network activity and transports it into the extension for processing

---

## 4) How to build and use

### Build (developer)

1. Prerequisite: **Node 18+**
2. Install and build:

```bash
cd backend
cp .env.example .env
# Set GEMINI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX
npm install
npm run dev
```

Server runs at `http://localhost:3001`.

### 2. Extension

```bash
cd yt-studyflow
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:3001
npm install
npm run build
```

Load `dist/` in Chrome → `chrome://extensions` → Load unpacked.

### 3. Auth web app (optional — only when re-enabling auth)

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Runs at `http://localhost:5174`.

---

## Environment Variables

### Extension (`.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Backend URL |
| `VITE_AUTH_WEB_URL` | Hosted Clerk app (when auth enabled) |

### Backend (`backend/.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes | Embeddings + generation |
| `PINECONE_API_KEY` | Yes (prod) | Vector storage |
| `PINECONE_INDEX` | No | Index name (default `yt-studyflow`) |
| `PINECONE_NAMESPACE` | No | Optional namespace prefix |
| `AUTH_DISABLED` | No | Bypass Clerk JWT (default `true` in dev) |
| `GUEST_USER_ID` | No | User id when auth disabled |
| `DATABASE_URL` | Prod | Postgres for sync |
| `CLERK_SECRET_KEY` | When auth on | JWT verification |

---

## Features

- **Chat** with hybrid RAG + timestamp citations
- **Notes** generation from transcript context
- **Quiz & flashcards** with SM-2 spaced repetition
- **Playlist-level RAG** — shared memory across lectures
- **Study mode** — learning paths with mastery tracking
- **Analytics** — confusion zones + progress heatmap

---

## IndexedDB vs Pinecone

| Data | Storage |
|------|---------|
| Transcript segments | Dexie (local) |
| Semantic chunk metadata | Dexie (local) |
| **Embeddings / vectors** | **Pinecone (server)** |
| Notes, flashcards, chat history | Dexie + Postgres sync |

---

## Re-enabling Authentication

1. Set `AUTH_DISABLED=false` in `backend/.env`
2. Set `AUTH_DISABLED = false` in `src/lib/config/auth.config.ts`
3. Set Clerk keys in backend + `web/.env`
4. Start the `web/` app for Google sign-in
5. Remove guest bypass blocks marked with `TODO:`

---

## License

MIT — side project for learning; not affiliated with Google or YouTube.
