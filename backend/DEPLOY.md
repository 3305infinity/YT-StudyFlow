Written for: whoever deploys and operates the YT StudyFlow backend on Render.

# Deploying the YT StudyFlow backend to Render

The extension talks to exactly one backend. If this service is down or misconfigured,
every AI feature in the extension stops working, so treat this as production.

---

## 1. Render service settings

Create a **Web Service** from this repository, then set:

| Setting | Value |
| --- | --- |
| **Environment** | Node |
| **Root Directory** | `backend` |
| **Build Command** | `npm install --include=dev && npm run build` |
| **Start Command** | `npm start` |
| **Node version** | 20 (pinned by `backend/.node-version`; `engines.node` requires >= 20) |
| **Health Check Path** | `/health` |
| **Instance type** | Free works; see the cold-start section before choosing |

Two settings here are easy to get wrong, and both fail the build:

**Root Directory must be `backend`.** The repository root is the Chrome extension;
building from there runs `vite build` and never produces a server. Symptom: the build
fails in seconds and the log mentions the extension or a missing `dist/index.js`.

**The build command needs `--include=dev`.** `NODE_ENV` is set to `production` (it has
to be, for the app itself), and npm honours that by skipping `devDependencies` — which
is where `typescript`, `@types/node`, `@types/express`, `@types/cors` and the `prisma`
CLI live. Without the flag, `tsc` fails with a few hundred `TS7006 / TS7016 / TS2580`
errors like *"Could not find a declaration file for module 'express'"*.

This is only about the build step; `NODE_ENV=production` still applies at runtime, which
is what matters for the app's own behaviour.

### What the build does

`npm run build` runs `node scripts/prisma-generate.mjs && tsc`:

1. **`scripts/prisma-generate.mjs`** generates the Prisma client. Prisma refuses to
   generate unless `DATABASE_URL` and `DIRECT_URL` are *present* in the environment,
   even though it never connects during generation. Since the database is optional for
   this deployment, that script substitutes harmless placeholder URLs when the real ones
   are unset, so a clean build succeeds with no database configured. Nothing connects to
   the placeholder — it just keeps database features switched off at runtime.
2. **`tsc`** compiles `src/` to `dist/`.

`npm start` then runs `node dist/index.js`.

---

## 2. Environment variables

Set these under **Environment → Environment Variables**.

### Required — the service will not start or will not function without them

| Variable | Example | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | Enables production checks and disables dev logging. **Must** be `production`. |
| `GROQ_API_KEY` | `gsk_…` | **All** text generation: chat answers, notes, summaries, chapters, flashcards, quizzes, translation. Startup throws without it. Get one at <https://console.groq.com/keys>. |
| `GEMINI_API_KEY` | `AIza…` | **Embeddings only** (`gemini-embedding-001`). Startup throws without it. Get one at <https://aistudio.google.com/apikey>. |
| `PINECONE_API_KEY` | `pcsk_…` | Vector storage and retrieval. Startup throws without it in production. |
| `PINECONE_INDEX` | `yt-studyflow` | Index name. **The index must have 3072 dimensions** to match `gemini-embedding-001`, with cosine metric. A mismatched index fails at query time, not at boot. |

### Recommended

| Variable | Example | Notes |
| --- | --- | --- |
| `PORT` | *(leave unset)* | Render injects this automatically and the app reads it. Only set it if you have a specific reason. |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | Defaults to `openai/gpt-oss-20b`. Must be a chat-completions model on your Groq account. If the configured model is decommissioned the backend discovers a live replacement automatically. |
| `PINECONE_NAMESPACE` | `prod` | Prefix applied to every namespace. Use different values for staging and production so their data cannot mix. |
| `EXTENSION_ID` | *(empty at first)* | See section 3. |
| `CORS_ORIGINS` | *(empty)* | See section 3. |

### Abuse protection — optional, sensible defaults built in

| Variable | Default | Notes |
| --- | --- | --- |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Shared window for both limiters. |
| `RATE_LIMIT_MAX_PER_WINDOW` | `30` | Requests per window **per extension install**. The `.env.example` suggests `60`. |
| `IP_RATE_LIMIT_MAX_PER_WINDOW` | `120` | Requests per window **per IP**, applied on top. Keep comfortably higher than the per-install limit so shared networks (campus, office) are not blocked, while one host still cannot mint unlimited install IDs. |
| `DAILY_QUOTA_MAX` | `200` | AI actions per user per day. **Only enforced when `DATABASE_URL` is set** — the usage log lives in Postgres. With no database this limit does nothing. |

### Optional

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | Postgres, for cloud sync and daily quotas. Leave unset to run local-first; every repository no-ops without it. |
| `AUTH_DISABLED` | Defaults to `true`. Leave it until sign-in is re-enabled. |
| `ALLOW_DEV_AUTH` | Leave unset/`false`. Setting `true` in production accepts `dev:<userId>` bearer tokens — do not enable on a public deploy. |

---

## 3. CORS and the extension ID — the two-stage step

You cannot know the extension's ID until the Chrome Web Store assigns it, so deploy in
two stages.

**Stage 1 — before the extension is published**

- Leave `EXTENSION_ID` **empty**.
- Leave `CORS_ORIGINS` **empty**.

With `EXTENSION_ID` empty the backend accepts any `chrome-extension://` origin, which is
what you need while testing an unpacked local build. `https://www.youtube.com` and
`https://youtube.com` are always allowed and never need listing.

**Stage 2 — once the Web Store assigns your ID**

1. Set `EXTENSION_ID` to the 32-character ID (lowercase letters a–p only, no
   `chrome-extension://` prefix). Example: `abcdefghijklmnopabcdefghijklmnop`.
2. Redeploy.

From then on that is the **only** extension origin accepted — the permissive
any-extension rule switches off automatically.

> **Important:** if `CORS_ORIGINS` currently contains the literal string
> `chrome-extension://YOUR_EXTENSION_ID`, delete it. It is a placeholder, it matches
> nothing, and leaving it in gives a false impression that CORS is configured. Set
> `EXTENSION_ID` instead. `CORS_ORIGINS` is only for extra browser origins beyond
> YouTube and your extension; most deployments leave it empty. A literal `*` is ignored.

Verify after redeploying:

```
curl -s https://yt-studyflow.onrender.com/health/deep | grep extensionIdConfigured
```

---

## 4. Health checks

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | **Point Render's health check here.** Returns 200 immediately with no database, Pinecone or AI provider calls, so it cannot fail because a third party is slow. |
| `GET /health/deep` | Readiness. Reports whether each provider is *configured*, deliberately without calling any of them, so it is fast and burns no quota. Returns 200 when Groq, Gemini and Pinecone all have keys, 503 otherwise. Never returns key material. |

Do not point Render at `/health/deep` — a missing optional key would cause Render to
restart a service that is otherwise serving traffic fine.

---

## 5. Free-tier cold starts

Render's free tier **suspends the service after about 15 minutes of inactivity**. The
next request has to wait for a full container boot, commonly **30–60 seconds**. This is
the single most common "the extension is broken" report, and it is not a bug.

The extension already handles this:

- request timeout is 60 seconds, not the usual few seconds;
- a failed request is retried once automatically after a short delay;
- the UI says the server is waking up rather than showing a connection error.

Your options, in increasing order of cost:

1. **Accept it.** First use after idle is slow; everything after is normal.
2. **Ping it.** An external uptime monitor hitting `/health` every 10–14 minutes keeps
   the instance warm. `/health` is intentionally unauthenticated and un-rate-limited so
   this is safe and cheap. Note this may violate Render's free-tier terms — check their
   current policy before relying on it.
3. **Upgrade to a paid instance.** Removes suspension entirely. This is the only option
   that actually fixes it.

---

## 6. Post-deploy checklist

```bash
# 1. Liveness — expect {"status":"ok",...}
curl -s https://yt-studyflow.onrender.com/health

# 2. Readiness — expect "status":"ready" and all three providers configured:true
curl -s https://yt-studyflow.onrender.com/health/deep

# 3. CORS — expect the header to echo back the YouTube origin
curl -si -H "Origin: https://www.youtube.com" https://yt-studyflow.onrender.com/health \
  | grep -i access-control-allow-origin

# 4. Rate limiting is active — expect a 429 after the per-install limit
for i in $(seq 1 70); do
  curl -s -o /dev/null -w "%{http_code} " \
    -H "X-Install-Id: 3f2a9c10-7b1d-4e55-9a02-61e0cbb4f8d1" \
    https://yt-studyflow.onrender.com/api/ai/health
done; echo
```

Then open a YouTube video with the extension installed and ask one question end to end.
Allow a minute for the first request if the instance was asleep.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Build fails with `P1012 Environment variable not found: DIRECT_URL` | `scripts/prisma-generate.mjs` was bypassed — someone changed the build command back to a bare `prisma generate` | Restore the build command to `npm install --include=dev && npm run build` |
| Build fails with hundreds of `TS7006` / `TS7016` / `TS2580` errors ("Could not find a declaration file for module 'express'", "Cannot find name 'process'") | `--include=dev` missing from the build command, so `NODE_ENV=production` made npm skip the `@types/*` packages | Set Build Command to `npm install --include=dev && npm run build` |
| Build fails in ~15s, log mentions `vite` or the extension | Root Directory is blank instead of `backend` | Set Root Directory to `backend` |
| Boot fails: `GROQ_API_KEY is required in production` | Key missing | Set `GROQ_API_KEY` and redeploy |
| Boot fails: `GEMINI_API_KEY is required in production for embeddings` | Key missing | Set `GEMINI_API_KEY` and redeploy |
| Extension shows "server is waking up" on every request | Free-tier suspension | See section 5 |
| Extension gets CORS errors after publishing | `EXTENSION_ID` is set to the wrong ID | Check the ID in `chrome://extensions`; it is 32 letters a–p with no prefix |
| Answers fail but embeddings work | Groq model decommissioned or key out of quota | Check `GROQ_MODEL` against <https://console.groq.com/docs/models> |
| Retrieval returns nothing for every video | Pinecone index has the wrong dimensions | The index must be 3072-dimensional; recreate it and re-index |
