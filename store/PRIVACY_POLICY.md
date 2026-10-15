# YT StudyFlow — Privacy Policy

**Last updated: 15 October 2026**

YT StudyFlow is a Chrome extension that helps you study the YouTube video you are
watching. This page explains, in plain language, exactly what data moves where.

If anything here is unclear, email us at **privacy@example.com** (replace with your
real support address before publishing).

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
`X-Install-Id` header.

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

| Where | Retention |
| --- | --- |
| **On your computer** (IndexedDB, chrome.storage) | Until you delete it or uninstall the extension. We never expire it for you. |
| **Transcripts and questions in transit** | Held in memory only for as long as it takes to produce your answer. We do not write them to a request log. |
| **Pinecone embeddings** | Kept so repeat questions about the same video are fast. Cleared when you clear the video's data in the extension, and purged for inactive namespaces at least every 90 days. |
| **Rate-limit counters** | In memory, reset on a rolling window of a few minutes. |
| **Server error logs** | Up to 30 days, retained by our hosting provider (Render) for debugging. These contain timestamps, status codes and IP addresses, not transcript content. |
| **Third-party AI providers** | Per their own retention policies, linked above. |

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

Questions, concerns or deletion requests: **privacy@example.com**

> **Before publishing:** replace `privacy@example.com` with a real monitored address,
> host this file at a public URL, and paste that URL into the Chrome Web Store listing's
> "Privacy policy URL" field. Also confirm the Pinecone and log retention figures match
> what you actually operate.
