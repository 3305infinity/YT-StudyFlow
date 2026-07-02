# UI Architecture (Phase 4)

## Layout

Four primary workspaces replace the previous 9-tab strip:

| Workspace | Purpose |
|-----------|---------|
| **Chat** | Structured Q&A with RAG sources |
| **Notes** | Editable, collapsible study notes |
| **Revision** | Flashcards (SM-2) + one-question-at-a-time quiz |
| **Analytics** | Session metrics, confusion heatmap, weak topics |

**Utilities** (header icons, overlay panels):

- Transcript — prerequisite setup, not a main dashboard
- Settings — profile / preferences
- Export — available via utility panel API (`setActiveTab('export')`)

Study / Chapters panels remain in codebase but are not in the main nav (consolidation path: Study → Chat modes, Chapters → Notes sections).

## Structured chat

Backend: `POST /api/chat/structured` → `chatStructured.service.ts`

Returns JSON fields rendered separately in the UI:

```json
{
  "summary", "explanation", "keyPoints", "relatedTopics",
  "confidenceScore", "citations", "sources"
}
```

Frontend pipeline stages (`pipeline.store.ts`) reflect real progress:

1. Searching knowledge base (RAG retrieve)
2. Generating response (Gemini)
3. Rendering citations (section reveal animation)

## State stores

| Store | Role |
|-------|------|
| `chat.store` | Messages, structured payloads, section reveal |
| `pipeline.store` | Real-time pipeline stage for loaders |
| `analytics.store` | Session events, quiz accuracy, flashcard stats |
| `revision.store` | Quiz index/score, flashcard stats |
| `ui.store` | Workspace tab + utility overlay |
| `rag.store` | Index build (unchanged) |

## Design system

- Neutral palette (`neutral-950` surface, minimal gradients)
- `WorkspaceShell` — consistent header for all workspaces
- `CollapsibleSection` — expandable content blocks
- `CitationGroup` — grouped sources with hover preview + jump
- `ErrorBanner` — actionable errors with retry

## Accessibility

- `role="tablist"` / `aria-selected` on workspace tabs
- `aria-live="polite"` on pipeline progress
- Focus rings on interactive elements
- Keyboard: Enter to send chat, tab navigation on controls
