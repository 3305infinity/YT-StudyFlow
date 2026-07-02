# YT StudyFlow — Backend Migration Progress

This document tracks the incremental refactor from a **client-side BYOK extension** to a **multi-user SaaS architecture**.

> **Rule:** No rewrites. Existing UI and features are preserved; only internal plumbing changes.

---

## Target architecture

```
Chrome Extension (UI + YouTube integration)
        ↓  HTTPS + Clerk JWT
Express Backend (Render / Railway)
        ↓
Gemini API · Pinecone · Supabase PostgreSQL
        ↓
JSON responses → Extension UI (unchanged panels)
```

**Security:** No API keys, embeddings secrets, or provider URLs with keys ever reach the browser.

---

## Phase 1 — Foundation ✅ (implemented)

### Backend (`backend/`)

| Area | Status | Notes |
|------|--------|-------|
| Express app + Helmet + CORS | ✅ | `src/app.ts`, `src/index.ts` |
| Clerk JWT auth middleware | ✅ | `@clerk/express` + dev bypass `Bearer dev:<userId>` |
| Rate limiting | ✅ | Per-user window + daily quota via `UsageLog` |
| Gemini service (server-only) | ✅ | `src/services/gemini.service.ts` |
| Pinecone service | ✅ | Namespace `userId_videoId` — optional until keys set |
| RAG service | ✅ | Index, embed, hybrid retrieve |
| REST routes | ✅ | See endpoints below |
| Prisma schema | ✅ | User, Video, Playlist, Chat, Note, Flashcard, Quiz, Transcript, UsageLog |
| Error handling | ✅ | Friendly messages, no stack traces to client |

**Endpoints (all require auth except `/health`):**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| GET | `/api/auth/me` | Current user profile |
| POST | `/api/ai/generate` | Text generation (chat, notes, quiz, etc.) |
| POST | `/api/ai/embed` | Embeddings |
| GET | `/api/ai/health` | AI subsystem check |
| POST | `/api/rag/index` | Chunk embed + Pinecone upsert |
| POST | `/api/rag/retrieve` | Hybrid vector + keyword retrieval |
| POST | `/api/rag/embed` | Embed chunks only |
| POST | `/api/chat` | Full chat pipeline (retrieve + generate) |

**Backend structure:**

```
backend/
  prisma/schema.prisma
  src/
    config/env.ts
    database/prisma.ts
    middleware/   auth, rateLimit, validate, errorHandler
    routes/       health, auth, ai, rag, chat
    controllers/  ai, auth, chat, rag
    services/     gemini, pinecone, rag
    repositories/ user, usage
    utils/        appError
```

### Extension changes

| Change | Status | Files |
|--------|--------|-------|
| API client layer | ✅ | `src/lib/api/client.ts`, `src/lib/api/auth.ts` |
| Auth store (Clerk session token) | ✅ | `src/store/auth.store.ts` |
| Gemini → backend proxy | ✅ | `src/features/ai/gemini.service.ts` now calls `/api/ai/*` |
| RAG embed/retrieve via backend | ✅ | `src/features/ai/hybridRetrieval.ts` |
| Removed direct Gemini from background | ✅ | `src/background/index.ts` |
| Removed API key storage & UI | ✅ | `storage.ts`, deleted `ApiKeyBanner.tsx` |
| Settings → Profile (sign-in) | ✅ | `src/pages/Settings.tsx` |
| AI readiness = auth, not API key | ✅ | `src/hooks/useAiReadiness.ts`, `FeatureGate.tsx` |
| Manifest v1.2.0 | ✅ | Removed `generativelanguage.googleapis.com` |

### What still runs locally (Phase 1)

These are **intentionally unchanged** to avoid breaking features:

- YouTube transcript fetching (content scripts + InnerTube)
- Dexie/IndexedDB cache (transcripts, chunks, notes, flashcards, quizzes, study plans)
- Keyword-only retrieval fallback
- All existing React panels (Chat, Notes, Study, Revision, etc.)
- Prompt building stays in extension; only **inference** moved to backend

---

## Authentication Phase ✅ (implemented — do not start Phase 2 data migration yet)

Production Clerk flow: extension → hosted web app → Google via Clerk → JWT → extension callback → backend verification.

### Flow

1. User clicks **Sign in with Google** in extension Profile
2. Popup opens `web/sign-in?ext_id=<extensionId>&redirect=extension`
3. Clerk handles Google OAuth (no manual OAuth in extension)
4. After login, web app redirects to `chrome-extension://<id>/auth/callback.html#token=<JWT>`
5. Extension callback saves **only** `studyflow_auth_token` in `chrome.storage.local`
6. Profile refreshes via `/api/auth/me` (name, email, avatar, usage)
7. Backend verifies JWT with `@clerk/backend` `verifyToken` on every protected route

### Added for auth

| Component | Path |
|-----------|------|
| Hosted auth app | `web/` (Vite + React + Clerk) |
| Extension callback | `public/auth/callback.html`, `callback.js` |
| JWT verification | `backend/src/middleware/auth.ts` |
| Profile UI | `src/pages/Settings.tsx` |

### Auth endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/auth/me` | Profile + usage remaining |
| GET | `/api/auth/usage` | Daily quota only |

### Security rules

- `ALLOW_DEV_AUTH` only when `NODE_ENV !== 'production'`; server **refuses to start** if enabled in prod
- No Clerk secret keys in extension or web app (publishable key only in `web/.env`)
- Invalid/missing JWT → `401` on all `/api/*` routes (except `/health`)

### Phase 2 — Blocked until auth verified in production

Do **not** migrate transcripts yet (Phase 2B).

---

## Phase 2A — Multi-user persistence ✅ (implemented)

Study data (notes, flashcards, quizzes, chat history, playlists, study sessions) is persisted in Postgres per authenticated user. Dexie remains as an **offline cache**; backend is source of truth when online.

**Not migrated:** transcripts, semantic chunks, embeddings (unchanged local).

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Extension UI (unchanged panels)                            │
└───────────────────────────┬─────────────────────────────────┘
                            │ read/write
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Dexie (IndexedDB) — offline cache                          │
│  fields: remoteId, dirty, lastSyncedAt, deleted, updatedAt  │
└───────────────────────────┬─────────────────────────────────┘
                            │ sync engine (push dirty → pull remote)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Express API  +  Clerk JWT  →  userId from token only       │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  PostgreSQL (Prisma) — one row per user per entity          │
└─────────────────────────────────────────────────────────────┘
```

### Sync flow

1. **Write path:** UI service writes to Dexie immediately (`dirty: true`) → UI updates (optimistic).
2. **Push:** `scheduleSync()` / `runSync()` POSTs dirty rows to backend; DELETE for removed records.
3. **Pull:** GET endpoints merge into Dexie (insert + update); set `dirty: false`, `lastSyncedAt = now`.
4. **Conflict:** compare `updatedAt`; **latest wins**. If local is dirty and newer, skip remote overwrite.
5. **Triggers:** sign-in / profile refresh, `window.online`, `chrome.alarms` (30 min), per-video `syncVideoScope()`, per-playlist `syncPlaylistScope()`, after mutations.
6. **Offline:** Dexie serves cached data; sync resumes when auth + backend health OK.
7. **Resilience:** each entity sync wrapped in `safeSync()` — one failure does not block others.

### Prisma changes

| Model | Change |
|-------|--------|
| `Chat` | Added `updatedAt DateTime @updatedAt` + index on `[userId, updatedAt]` |
| `StudySession` | **New** — `playlistId`, `topic`, `level`, `payload Json`, scoped by `userId` |
| `User` | Added `studySessions StudySession[]` relation |

Run after pulling:

```bash
cd backend
npm run db:generate
npx prisma db push   # or migrate dev — requires DATABASE_URL
```

### API routes (all require auth; `userId` from JWT)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/notes` | List notes (`?videoId=` optional) |
| GET | `/api/notes/:id` | Get single note |
| POST | `/api/notes` | Create note |
| PATCH | `/api/notes/:id` | Update note |
| DELETE | `/api/notes/:id` | Delete note |
| GET | `/api/flashcards` | List (`?videoId=` or `?playlistId=`) |
| GET | `/api/flashcards/:id` | Get single flashcard |
| POST | `/api/flashcards` | Upsert flashcards batch |
| PATCH | `/api/flashcards/:id` | Update flashcard |
| DELETE | `/api/flashcards/:id` | Delete flashcard |
| GET | `/api/quizzes` | List quizzes (`?videoId=` optional) |
| GET | `/api/quizzes/:id` | Get single quiz |
| POST | `/api/quizzes` | Upsert quiz |
| PATCH | `/api/quizzes/:id` | Update quiz |
| DELETE | `/api/quizzes/:id` | Delete quiz |
| GET | `/api/history` | Chat history (`?videoId=` optional) |
| GET | `/api/history/:id` | Get single message |
| POST | `/api/history` | Upsert chat messages batch |
| PATCH | `/api/history/:id` | Update message |
| DELETE | `/api/history/:id` | Delete message |
| DELETE | `/api/history?videoId=` | Clear all chat for video |
| GET | `/api/playlists` | List playlists |
| GET | `/api/playlists/:id` | Get single playlist |
| POST | `/api/playlists` | Upsert playlist |
| PATCH | `/api/playlists/:id` | Update playlist |
| DELETE | `/api/playlists/:id` | Delete playlist |
| GET | `/api/study-sessions` | Study plans (`?playlistId=` optional) |
| GET | `/api/study-sessions/:id` | Get single session |
| POST | `/api/study-sessions` | Upsert study session |
| PATCH | `/api/study-sessions/:id` | Update session |
| DELETE | `/api/study-sessions/:id` | Delete session |

**Security:** every repository query filters `where: { userId }` from `req.userId` (middleware). Frontend never sends `userId`.

### Repositories (8 entities)

| Repository | File | Methods |
|------------|------|---------|
| User | `user.repository.ts` | `findById`, `upsertFromClerk` |
| Video | `video.repository.ts` | `ensure`, `findByYoutubeId`, `findById`, `list`, `delete` |
| Chat | `chat.repository.ts` | `list`, `findById`, `upsertMany`, `update`, `delete`, `deleteByVideo` |
| Note | `notes.repository.ts` | `list`, `findById`, `create`, `update`, `delete` |
| Flashcard | `flashcards.repository.ts` | `list`, `findById`, `upsertMany`, `update`, `delete` |
| Quiz | `quizzes.repository.ts` | `list`, `findById`, `upsert`, `update`, `delete` |
| Playlist | `playlists.repository.ts` | `list`, `findById`, `upsert`, `update`, `delete` |
| StudySession | `studySessions.repository.ts` | `list`, `findById`, `upsert`, `update`, `delete` |

`history.repository.ts` re-exports `chatRepository` for backward compatibility.

### Backend structure (Phase 2A additions)

```
backend/src/
  repositories/  user, video, chat, notes, flashcards, quizzes, playlists, studySessions
  services/      (matching *.service.ts)
  controllers/   (matching *.controller.ts)
  routes/        notes, flashcards, quizzes, history, playlists, study-sessions
```

### Extension changes (Phase 2A)

| Area | Files |
|------|-------|
| Dexie v3 sync fields | `src/lib/db.ts` — `remoteId`, `dirty`, `lastSyncedAt`, `deleted`; `chatHistory` table |
| Sync engine | `src/lib/sync/engine.ts`, `*.sync.ts` (6 entity modules) |
| API client | `src/lib/api/client.ts` — `patch`, `delete`, 204 handling |
| Wired services | `notes.service.ts`, `chat.service.ts`, `flashcards.ts`, `quiz.ts`, `playlist.service.ts`, `studyAgent.service.ts` |
| Auth → sync | `src/store/auth.store.ts` — `runSync()` on load/refresh; online listener |
| Background sync | `src/background/index.ts` — `chrome.alarms` every 30 min + auth callback |
| Chat history | `useChat.ts`, `history.sync.ts` — remote clear on delete |
| Cross-device pull | flashcards, playlists, study sessions insert on pull |
| Delete propagation | flashcards, quizzes, chat clear → backend DELETE |

### Files added (Phase 2A)

**Backend:** all `repositories/*`, `services/*`, `controllers/*`, `routes/*` for the six entity groups above (except pre-existing auth/ai/rag/chat).

**Extension:**

- `src/lib/sync/engine.ts`
- `src/lib/sync/notes.sync.ts`
- `src/lib/sync/flashcards.sync.ts`
- `src/lib/sync/quizzes.sync.ts`
- `src/lib/sync/history.sync.ts`
- `src/lib/sync/playlists.sync.ts`
- `src/lib/sync/studySessions.sync.ts`

### Files modified (Phase 2A)

- `backend/prisma/schema.prisma`
- `backend/src/app.ts`
- `src/lib/db.ts`
- `src/lib/api/client.ts`
- `src/store/auth.store.ts`
- `src/features/notes/notes.service.ts`
- `src/features/chat/chat.service.ts`, `chat.store.ts`, `hooks/useChat.ts`
- `src/features/revision/flashcards.ts`, `quiz.ts`
- `src/features/playlist/playlist.service.ts`
- `src/features/study/studyAgent.service.ts`

---

## Phase 2B — Planned (not started)

| Task | Priority |
|------|----------|
| Persist transcripts to Postgres via `POST /api/transcripts` | High |
| Full Pinecone-only retrieval (drop client-side vectors) | Medium |
| Dedicated routes: `/summarize`, `/flashcards`, `/quiz`, `/notes` (AI) | Medium |
| Supabase migrations in CI | Medium |

---

## Phase 2 — Legacy planned section (superseded by 2A/2B)

| Task | Status |
|------|--------|
| Move notes/quizzes/flashcards CRUD to backend | ✅ Phase 2A |
| Chat history → `Chat` model + `/api/history` | ✅ Phase 2A |
| Persist transcripts | ⏳ Phase 2B |

---

## Phase 3 — Planned (not started)

| Task | Priority |
|------|----------|
| Remove Dexie as source of truth (keep as offline cache only) | High |
| Deploy backend → Railway/Render | High |
| Deploy Clerk + web sign-in → Vercel | High |
| Production CORS with extension ID | High |
| Usage dashboard / admin quotas | Low |

---

## Local development

### 1. Backend

```bash
cd backend
cp .env.example .env
# Set GEMINI_API_KEY at minimum; DATABASE_URL optional for Phase 1
npm install
npm run db:generate
npm run dev
```

Server runs at `http://localhost:3001`.

**Dev auth (no Clerk yet):** set `ALLOW_DEV_AUTH=true`, then in extension Profile click **Dev sign-in**.

### 2. Extension

```bash
cd yt-studyflow
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:3001
npm install
npm run build
# Load dist/ in chrome://extensions
```

### 3. Verify Phase 1

1. Backend `/health` returns `{ ok: true }`
2. Extension Profile → Dev sign-in → Test AI connection
3. Open YouTube lecture → Transcript loads
4. Chat / Notes / Quiz still render (same UI)
5. Network tab: requests go to `localhost:3001`, **not** `generativelanguage.googleapis.com`

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Prod yes | Server-side AI |
| `CLERK_SECRET_KEY` | Prod yes | JWT verification |
| `DATABASE_URL` | Prod yes | Supabase Postgres |
| `PINECONE_API_KEY` | Optional | Vector search |
| `PINECONE_INDEX` | Optional | Index name |
| `ALLOW_DEV_AUTH` | Dev only | Skip Clerk locally |

### Extension (`.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Backend URL |
| `VITE_CLERK_SIGN_IN_URL` | Hosted sign-in page |

---

## Files changed in Phase 1

### Added
- `backend/**` (full server)
- `src/lib/api/client.ts`
- `src/lib/api/auth.ts`
- `src/store/auth.store.ts`
- `src/features/ai/gemini.service.types.ts`
- `MIGRATION.md` (this file)

### Modified
- `src/features/ai/gemini.service.ts`
- `src/features/ai/hybridRetrieval.ts`
- `src/features/ai/ragPipeline.service.ts`
- `src/background/index.ts`
- `src/lib/storage.ts`
- `src/lib/env.ts`
- `src/lib/constants.ts`
- `src/store/settings.store.ts`
- `src/store/rag.store.ts`
- `src/hooks/useAiReadiness.ts`
- `src/pages/Settings.tsx`
- `src/components/FeatureGate.tsx`
- `src/sidebar/SidebarLayout.tsx`
- `src/features/chat/ChatPanel.tsx`
- `src/features/chat/chat.service.ts`
- `public/manifest.json`
- `.env.example`

### Removed
- `src/components/ApiKeyBanner.tsx`
- Direct Gemini calls from extension bundle
- `generativelanguage.googleapis.com` host permission

---

## Last updated

**Phase 2A complete** (DB pushed to Supabase) — full repository CRUD, REST endpoints, Dexie offline cache, resilient sync engine, background alarms sync.  
**Transcripts/embeddings not migrated** (Phase 2B).

---

## Phase 3 — Pinecone RAG + Auth Disabled ✅

### Auth temporarily disabled (not deleted)

- `AUTH_DISABLED=true` in `backend/src/config/auth.config.ts` and `src/lib/config/auth.config.ts`
- Backend `requireAuth` assigns `GUEST_USER_ID` when disabled
- Extension uses guest profile; all Clerk/web/callback files preserved with `TODO:` markers
- Re-enable: set `AUTH_DISABLED=false` in both config files + backend `.env`

### Pinecone-only vector storage

- Embeddings no longer written to Dexie `embeddings` table
- Index: `POST /api/rag/index` → Gemini embed → Pinecone upsert
- Retrieve: `POST /api/rag/retrieve` → hybrid keyword + Pinecone semantic (cosine)
- Chunk metadata still cached locally in Dexie `semanticChunks`

### Backend service modules

| Service | File |
|---------|------|
| EmbeddingService | `backend/src/services/embedding.service.ts` |
| PineconeService | `backend/src/services/pinecone.service.ts` |
| RetrievalService | `backend/src/services/retrieval.service.ts` |
| RAG orchestrator | `backend/src/services/rag.service.ts` |
| PromptBuilder | `backend/src/services/promptBuilder.service.ts` |
| CitationService | `backend/src/services/citation.service.ts` |

### Env vars (backend)

- `PINECONE_API_KEY`, `PINECONE_INDEX`, `PINECONE_NAMESPACE`
- `AUTH_DISABLED`, `GUEST_USER_ID`
