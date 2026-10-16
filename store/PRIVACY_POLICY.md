# YT StudyFlow — Privacy Policy

**Last updated: 16 October 2026**

YT StudyFlow is a Chrome extension that helps you study the YouTube video you are
watching. This page explains, in plain language, exactly what data moves where.

If anything here is unclear, email us at **nishthap1410@gmail.com**.

---

## The short version

- You do **not** need an account. We do not ask for your name, email or any sign-in.
- Your notes, flashcards, quizzes and chat history stay **on your computer**.
- When you ask a question, the **video transcript and your question** are sent to our
  server and to our AI providers so an answer can be generated. Google Gemini sees
  transcript text only, to build a search index; Groq sees transcript excerpts and your
  question, and writes the answer.
- We **never sell your data**, never share it with data brokers, and never use it for
  advertising or ad targeting.

---

## What we collect and why

### 1. Data that leaves your computer

When you use an AI feature (asking a question, generating a summary, notes, flashcards
or a quiz), the extension sends the following to our backend at
`https://yt-studyflow.onrender.com`:

| Data | Why |
| --- | --- |
| The **transcript / captions** of the video you are watching | This is the material the AI reads to answer you |
| **Your question or prompt** | So the AI knows what to answer |
| The **YouTube video ID** | To keep answers for different videos separate |
| Your **anonymous install ID** (see below) | To apply fair-use limits and keep your data separate from other users' |
| Your **IP address** | Unavoidably visible to any web server; used only for abuse protection |

Our backend then passes this content to third-party AI services. Each one receives only
what it needs for its specific job:

- **Google Gemini** — receives **transcript text only, and only to create embeddings**
  (numeric representations used for search). It is never sent your questions, and it
  never writes any of the text you read. Embeddings are the only thing we use Gemini for.
- **Groq** — receives **transcript excerpts and your questions**, and generates all of
  the text you see: chat answers, summaries, notes, chapter titles, flashcards, quizzes,
  study plans, and transcript translations.
- **Pinecone** — stores the Gemini embeddings together with the transcript passages they
  came from, so the relevant part of a long video can be found quickly. Each
  installation's vectors live in their own namespace, keyed by your anonymous install ID
  and the video ID.

These providers process the data to return a result to us. Each has its own privacy
policy and terms:

- Google Gemini API: <https://ai.google.dev/gemini-api/terms>
- Groq: <https://groq.com/privacy-policy/>
- Pinecone: <https://www.pinecone.io/privacy/>

We do **not** send them your name, email, IP address or browsing history, because we
do not have them.

### 2. Data that stays on your computer

The following never leaves your browser unless you explicitly export it. It is stored
in your browser's **IndexedDB** and in **chrome.storage**:

**IndexedDB** (local database, created by the extension):

- Video transcripts and the transcript passages derived from them
- Embeddings cached for faster repeat questions
- Your **notes** (AI-generated and your own)
- **Flashcards** and their review schedule
- **Quizzes** and your answers
- **Chat history** with the assistant
- Auto-detected chapters
- Local usage analytics (counts of actions you took, to drive the progress UI)
- Playlists and study plans you create

**chrome.storage.sync**: your extension settings (theme, panel preferences and similar).
Chrome may sync these across devices where you are signed into Chrome; this is handled by
Chrome, not by us.

**chrome.storage.local**: your anonymous install ID.

You can delete all of this at any time by removing the extension from Chrome, or by
clearing the extension's data from Chrome's site/extension settings.

### 3. The anonymous install ID

The first time the extension runs, it generates a **random UUID** (for example
`3f2a9c10-7b1d-4e55-9a02-61e0cbb4f8d1`) and saves it under `studyflow_install_id` in
`chrome.storage.local`. It is sent with every request to our backend in the
`X-Install-Id` header. You can see it any time under **Settings → Privacy**.

- It is generated locally by your browser from random data.
- It is **not** derived from your device, hardware, account, email or IP address.
- It cannot be used to identify you personally.
- It exists only so that fair-use limits, daily quotas and stored transcript data belong
  to *your* installation rather than being pooled with every other user's.
- Reinstalling the extension creates a brand new ID and disconnects you from the old one.

If no valid install ID is sent, our backend falls back to rate-limiting by IP address.

### 4. What we do **not** collect

- No names, email addresses, phone numbers or physical addresses
- No passwords or authentication credentials
- No payment or financial information
- No health information
- No browsing history, and no record of which pages you visit outside the YouTube
  video you are actively using the extension on
- No location data
- No advertising or cross-site tracking identifiers
- No keystroke logging or mouse tracking

---

## How long we keep things

We are deliberately specific here, because we would rather state a plain fact than a
reassuring number we do not actually enforce.

| Where | What is kept | How long |
| --- | --- | --- |
| **Your browser** — IndexedDB and chrome.storage | Notes, flashcards and their review schedule, quizzes, chat history, cached transcripts, chapters, playlists, local progress counters, your settings, and the anonymous install ID | **Until you delete it.** Nothing expires on its own. Removing the extension or clearing its data removes all of it. |
| **Pinecone** — vector database | Embeddings plus, as metadata, the transcript passage text (first 1000 characters per passage), its start/end timestamps, the video ID and video title. Stored in a namespace named after your anonymous install ID and the video ID. | **Kept indefinitely until deleted.** There is no automatic expiry and no scheduled purge job. It is deleted when you clear a video's data in the extension, when you call the deletion endpoint below, or when you email us. |
| **Transcripts and questions in transit** | Nothing | Held in memory only for the duration of the request. They are not written to a request log. |
| **Server-side caches** | Query rewrites, embeddings, retrieval results and packed context, capped at 1000 entries each | **Minutes.** 15 minutes for query rewrites, retrieval results and packed context; 60 minutes for embeddings. All of it is in memory only and is lost whenever the server restarts or redeploys. |
| **Rate-limit counters** | Your install ID and IP address | In memory, on a rolling window of about a minute. Lost on restart. |
| **Database (PostgreSQL)** | Only used if the optional `DATABASE_URL` is configured. When enabled it stores a usage log (install ID, action name, timestamp) and any personal notes you sync. | **Until deleted.** This deployment currently runs with cloud sync off, so in practice nothing is written here. |
| **Server logs** | Timestamps, HTTP status codes, IP addresses and error messages. Transcript text and your questions are **not** logged in production. | Held by our hosting provider, Render, under their own log-retention policy. We do not control that window and so do not quote one. |
| **Third-party AI providers** | Per their own retention policies, linked above. | Set by Google, Groq and Pinecone, not by us. |

### Deleting your data

- **Everything on your computer:** remove the extension, or clear its data from Chrome's
  extension settings. This is immediate and needs nothing from us.
- **Your stored vectors for one video:** the extension can erase them, which calls
  `DELETE /api/rag/video/<videoId>` on our backend. That endpoint deletes only the
  namespace belonging to your own install ID, so it can never touch anyone else's data.
- **Everything we hold for your installation:** email **nishthap1410@gmail.com** with your
  install ID and we will delete it. You can find your install ID in the extension's
  settings. We do not need, and will not ask for, any other identifying information.

---

## Sharing and selling

We do **not**:

- sell your data, in any form, to anyone;
- transfer your data to third parties for any purpose unrelated to producing your answer;
- use your data for advertising, ad targeting or to build user profiles;
- use your data to train our own or anyone else's AI models;
- share your data with data brokers.

The only third parties that see your data are the AI and infrastructure providers listed
above, acting on our behalf to produce the result you asked for, plus our hosting
provider (Render) which operates the server.

---

## Children

YT StudyFlow is not directed at children under 13. We do not knowingly collect personal
information from children. Because we collect no personal information from anyone, there
is nothing for us to delete on request — but you may contact us with any concern.

---

## Security

- All traffic between the extension, our backend and our AI providers uses HTTPS.
- The extension requests the minimum Chrome permissions it needs, and its background
  service worker will only make network requests to our own backend and to YouTube.
- The extension contains no remotely-loaded or dynamically-evaluated code. Everything
  that runs is in the package you installed from the Chrome Web Store.

---

## Changes to this policy

If we change what data we collect or who processes it, we will update this page and the
"Last updated" date above, and raise the extension version. Material changes will be
noted in the Chrome Web Store listing.

---

## Contact

Questions, concerns or deletion requests: **nishthap1410@gmail.com**

For a deletion request, include the anonymous install ID shown in the extension's
Settings → Privacy section. That is all we need, and all we can act on.
