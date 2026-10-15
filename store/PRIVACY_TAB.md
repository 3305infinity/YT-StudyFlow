# Chrome Web Store — "Privacy practices" tab answers

Field-by-field answers for the Developer Dashboard. Check each one against the code
before you submit: you are certifying these, and a wrong answer gets the item taken down.

---

## 1. Single purpose

> An extension must have a single purpose that is narrow and easy to understand.

```
YT StudyFlow has one purpose: to help the user study the YouTube video they are currently watching, by turning that video's transcript into answers, notes, flashcards and quizzes.

Every feature in the extension serves that purpose. The extension only activates on YouTube watch pages, only reads the transcript of the video on the page the user is viewing, and only sends that transcript and the user's own question to our backend so an AI answer can be generated and returned to the same page.
```

---

## 2. Permission justifications

See **store/LISTING.md → Permission justifications** for the full text of all four
(`storage`, `scripting`, `https://*.youtube.com/*`, `https://yt-studyflow.onrender.com/*`).

---

## 3. Remote code

> Are you using remote code?

**Answer: No, I am not using remote code.**

Justification, if asked:

```
All JavaScript executed by this extension is bundled into the uploaded package. The extension does not load scripts from a server, does not use eval() or new Function() on fetched content, and does not inject any externally-hosted code.

The extension uses chrome.scripting.executeScript with the "func" parameter to run two functions in the YouTube page context. Both of those functions are compiled into the extension package — Chrome serialises them from the installed bundle. No code is fetched from the network and run.

Network requests made by the extension return JSON data only, which is parsed as data and never executed.
```

---

## 4. Data collection disclosures

Tick **only** the boxes listed as "YES" below.

| Data type | Collected? | Notes |
| --- | --- | --- |
| Personally identifiable information | **NO** | No name, address, email, age or ID number is collected. No account required. |
| Health information | **NO** | — |
| Financial and payment information | **NO** | — |
| Authentication information | **NO** | No passwords or credentials are collected. Sign-in is disabled in this version. |
| Personal communications | **NO** | No emails, texts or chat messages are read. |
| Location | **NO** | — |
| Web history | **NO** | We do not record the list of pages the user visits. |
| User activity | **YES** | See below. |
| Website content | **YES** | See below. |

### Why "User activity" is YES

```
When the user asks a question or requests notes, flashcards or a quiz, that typed question / prompt is sent to our backend and on to Groq, which generates the answer text. Questions are never sent to Google Gemini. The backend also counts how many AI actions each installation performs, in order to enforce fair-use rate limits and a daily quota.

Study activity itself — notes written, flashcards reviewed, quiz scores — is stored only in the user's own browser and is not transmitted.
```

### Why "Website content" is YES

```
The extension reads the caption track / transcript of the YouTube video the user is watching, and sends it to our backend so the AI can answer questions about it. This is text content taken from the page.

At the backend the transcript is used in two ways: Google Gemini receives transcript text solely to generate embeddings (a numeric search index, stored in Pinecone), and Groq receives transcript excerpts together with the user's question to generate the answer text and any translations.

No other page content is read or transmitted, and nothing is read on any site other than a YouTube watch page the user has open.
```

---

## 5. Data usage certifications

Tick all three. They are all true for this extension:

- [x] **I do not sell or transfer user data to third parties, outside of the approved use cases.**
      Transcript text goes to Google Gemini solely to build embeddings; transcript
      excerpts and the user's question go to Groq solely to generate the answer; both are
      stored in Pinecone only to make retrieval fast. That is the approved "to provide the
      single purpose" use case, not a sale or transfer.
- [x] **I do not use or transfer user data for purposes that are unrelated to my item's single purpose.**
- [x] **I do not use or transfer user data to determine creditworthiness or for lending purposes.**

---

## 6. Privacy policy URL

Required, because data collection boxes are ticked.

```
https://example.com/yt-studyflow/privacy
```

> **Before publishing:** host `store/PRIVACY_POLICY.md` (rendered, e.g. on GitHub Pages
> or your own site) at a public, non-expiring URL and paste it here. The policy must be
> reachable without a login.

---

## 7. Account / sign-in

> Does your extension require users to sign in?

**Answer: No.** The extension is fully usable with no account.

---

## Reviewer notes (optional "Notes for reviewer" field)

```
Testing instructions:

1. Install the extension.
2. Open any YouTube video that has captions enabled, e.g. a conference talk or lecture.
3. The StudyFlow panel appears next to the player. Click it and type a question about the video.
4. An answer appears with clickable timestamps.

No account or test credentials are needed.

Network activity: the extension talks to exactly one backend, https://yt-studyflow.onrender.com, which holds our AI provider keys. It also reads the caption track from the YouTube page context. The background service worker validates every proxied URL against an allowlist (our backend origin for API calls; youtube.com / googlevideo.com hosts for caption fetches) and rejects anything else, and it ignores messages that do not originate from this extension.
```
