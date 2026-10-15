# Chrome Web Store listing — YT StudyFlow

Copy/paste source for the Web Store "Store listing" tab.

---

## Store name

```
YT StudyFlow — Study any YouTube video
```

(38 characters; the limit is 75.)

---

## Short description

Limit: **132 characters**. The text below is **115**.

```
Turn any YouTube video into a study session: ask questions, get timestamped answers, notes, flashcards and quizzes.
```

---

## Category

Education

## Language

English

---

## Long description

```
YT StudyFlow turns the YouTube video you are already watching into an interactive study session.

Instead of scrubbing back and forth through a two-hour lecture, ask a question in plain English and get an answer drawn from the video's own transcript — with timestamps you can click to jump straight to the moment it was explained.

WHAT YOU CAN DO

• Ask anything about the video
  Type a question and get an answer grounded in what the speaker actually said. Every answer cites the timestamps it came from, so you can verify it in one click.

• Generate notes
  Produce clean, structured notes from the video's transcript — summaries, key points and definitions — then edit them yourself and keep them.

• Build flashcards
  Create flashcards straight from the material and review them on a spaced-repetition schedule, so what you watched today is still there next week.

• Take a quiz
  Test yourself with questions generated from the video, and see which sections you need to rewatch.

• Auto chapters
  Long, unstructured videos get a chapter breakdown so you can navigate by topic instead of by timeline.

• Study across a playlist
  Group related videos and build notes and flashcards that span a whole course, not just one lecture.

WHY IT IS DIFFERENT

Answers are grounded in the transcript. The assistant works from what the video says, not from general knowledge, and it tells you where in the video each claim came from — so you can check it rather than trust it.

PRIVACY

• No account, no sign-up, no email required. Install and start using it.
• Your notes, flashcards, quizzes and chat history are stored locally in your browser, not on our servers.
• To generate an answer, the video's transcript and your question are sent to our backend and processed by Google Gemini, Groq and Pinecone. That is the only content that leaves your machine.
• We identify your installation with a random anonymous ID so fair-use limits are per person. It is not linked to you, your device or any account.
• We never sell your data and never use it for advertising.

Full privacy policy: https://example.com/yt-studyflow/privacy

GETTING STARTED

1. Install the extension.
2. Open any YouTube video that has captions.
3. Click the YT StudyFlow panel and ask your first question.

It works best on videos with captions available — lectures, talks, tutorials and courses. Videos with captions disabled cannot be analysed.

Questions or problems? Email support@example.com
```

> **Before publishing:** replace `https://example.com/yt-studyflow/privacy` and
> `support@example.com` with your real URLs, and update `homepage_url` in
> `public/manifest.json` to match.

---

## Single purpose statement

Paste into **Privacy practices → Single purpose**:

```
YT StudyFlow has one purpose: to help the user study the YouTube video they are currently watching, by turning that video's transcript into answers, notes, flashcards and quizzes.

Every feature in the extension serves that purpose. The extension only activates on YouTube watch pages, only reads the transcript of the video on the page the user is viewing, and only sends that transcript and the user's own question to our backend so an AI answer can be generated and returned to the same page.
```

---

## Permission justifications

Paste each into the matching field in **Privacy practices → Permission justification**.

### `storage`

```
Used to save the user's own study material and settings locally in the browser.

Specifically: notes, flashcards and their review schedule, quizzes, chat history, cached transcripts and auto-detected chapters are stored in the extension's local database so they survive a page reload or browser restart. chrome.storage.sync holds the user's display preferences (theme and panel layout). chrome.storage.local holds a randomly generated anonymous installation ID, which is sent to our backend so fair-use rate limits apply per installation instead of being shared across all users.

No browsing history or personal information is stored.
```

### `scripting`

```
Used to run two small, bundled functions in the page context ("MAIN" world) of the YouTube watch page the user is on.

1. Reading the caption track. YouTube exposes a video's caption data to its own page context only. To read the transcript the extension must run a fetch from inside that page context; it cannot be done from an isolated content script.

2. Turning captions on. If the user asks for a transcript on a video where captions are off, the extension clicks YouTube's own subtitles button so the caption track becomes available.

Both injected functions are part of the extension package — no remote or dynamically generated code is ever injected. Injection only ever targets the YouTube tab the user is actively using.
```

### Host permission: `https://www.youtube.com/*` and `https://youtube.com/*`

```
This is the site the extension works on. The content script that renders the StudyFlow panel runs on YouTube watch pages, reads the video ID and the video's caption track, and injects the UI alongside the player.

Both forms are listed because YouTube serves watch pages from both the www and bare apex hostname. The extension's content scripts are restricted to /watch* URLs only, so it does not run on the YouTube home page, search results, or any other site.
```

### Host permission: `https://yt-studyflow.onrender.com/*`

```
This is our own backend, and the only server the extension talks to.

When the user asks a question or requests notes, flashcards or a quiz, the extension sends the video transcript and the user's question to this server. The server runs the retrieval and generation pipeline (Google Gemini for embeddings, Pinecone for retrieval, Groq for the written answer) and returns the result.

All AI provider API keys live on this server and are never shipped in the extension. The extension's background service worker validates that every request it proxies targets exactly this origin, so it cannot be used to fetch arbitrary URLs.
```

---

## Assets checklist (not yet produced)

These still need to be created before submission — they are images, not text:

- [ ] Store icon, 128×128 PNG (`public/icons/icon128.png` can be reused)
- [ ] At least one screenshot, 1280×800 or 640×400 PNG/JPEG (up to 5)
- [ ] Optional: small promo tile 440×280, marquee promo tile 1400×560
- [ ] Optional: YouTube demo video URL
