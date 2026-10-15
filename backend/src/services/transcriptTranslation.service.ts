import { groqService, mapWithConcurrency, GROQ_CHARS_PER_TOKEN } from './groq.service.js';
import type { ResponseLanguageId } from '../lib/languages.js';
import { AppError } from '../utils/appError.js';
import { ragDevLog } from './rag/devLog.js';
import { env } from '../config/env.js';

type TranscriptSegment = {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  duration: number;
  index: number;
};

/** Hard ceiling on segments per request, regardless of how short they are. */
const MAX_SEGMENTS_PER_BATCH = 12;

/**
 * Prompt budget for one translation request, in characters.
 *
 * gpt-oss-20b has a 131k-token window, but the reply must fit too and translated text
 * can be longer than the source (Devanagari especially). We budget ~6k input tokens per
 * batch against the 4096-token reply cap, which leaves a wide safety margin.
 */
const MAX_BATCH_INPUT_CHARS = 6_000 * GROQ_CHARS_PER_TOKEN;

/**
 * Splits segments into batches that fit the prompt budget, preserving order.
 * A single oversized segment still gets its own batch rather than being dropped.
 */
function batchSegments(segments: TranscriptSegment[]): TranscriptSegment[][] {
  const batches: TranscriptSegment[][] = [];
  let current: TranscriptSegment[] = [];
  let currentChars = 0;

  for (const segment of segments) {
    // Roughly what this segment costs once serialised as JSON.
    const cost = JSON.stringify(segment).length;

    if (
      current.length > 0 &&
      (current.length >= MAX_SEGMENTS_PER_BATCH || currentChars + cost > MAX_BATCH_INPUT_CHARS)
    ) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(segment);
    currentChars += cost;
  }

  if (current.length) batches.push(current);
  return batches;
}

type TranslatedChunk = { id?: string; text?: string };

/**
 * Rebuilds segments from the model's reply.
 *
 * Only `text` is taken from the model — id, startTime, endTime, duration and index are
 * always carried over from the source, so timings can never drift even if the model
 * echoes them back wrong. Throws if any source segment is missing a translation.
 */
function applyTranslation(parsed: { chunks?: TranslatedChunk[] }, source: TranscriptSegment[]): TranscriptSegment[] {
  if (!Array.isArray(parsed.chunks)) throw new Error('missing chunks array');

  const byId = new Map(
    parsed.chunks.filter((c): c is TranslatedChunk & { id: string } => typeof c.id === 'string').map((c) => [c.id, c])
  );

  const missing = source.filter((seg) => !byId.get(seg.id)?.text?.trim());
  if (missing.length) {
    throw new Error(`missing translated segments: ${missing.map((s) => s.id).join(', ')}`);
  }

  return source.map((seg) => ({ ...seg, text: byId.get(seg.id)!.text!.trim() }));
}

const TRANSLATION_SYSTEM = [
  'You are a high-precision subtitle and study material translation engine for YT StudyFlow.',
  'Translate the text of each caption segment into the requested language.',
  'Rules:',
  '1. Return a JSON object of the form {"chunks":[{"id":"<segment id>","text":"<translated text>"}]}.',
  '2. Return one entry for EVERY segment you were given, using the exact same id string.',
  '3. Do not merge, split, reorder or omit segments.',
  '4. Translate only the text. Do not echo timings.',
  '5. Do not add markdown formatting or commentary outside the JSON.',
  '6. Handle target language modes accurately:',
  '   - English: Natural, accurate English.',
  '   - Hindi: Natural Hindi in Devanagari script.',
  '   - Hinglish: Natural conversational Hindi written in Roman script, keeping technical terms in English (e.g., "Transformer model ka compute complexity O(N^2) hota hai").',
].join('\n');

/** One batch, with a single retry at lower temperature before giving up. */
async function translateBatch(
  segments: TranscriptSegment[],
  targetLanguage: ResponseLanguageId,
  sourceLanguage?: string
): Promise<TranscriptSegment[]> {
  // Only id + text are sent; timings stay server-side and are reattached after.
  const payload = segments.map((s) => ({ id: s.id, text: s.text }));
  const baseUser = [
    sourceLanguage ? `Source caption language: ${sourceLanguage}` : '',
    `Target language: ${targetLanguage}`,
    `Translate all ${segments.length} segments below.`,
    JSON.stringify({ chunks: payload }),
  ]
    .filter(Boolean)
    .join('\n');

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const user =
      attempt === 0
        ? baseUser
        : `${baseUser}\n\nYour previous reply was rejected: ${
            lastError instanceof Error ? lastError.message : String(lastError)
          }. Return every segment id exactly once, with non-empty translated text.`;

    const startTime = Date.now();
    try {
      const result = await groqService.generateJson<{ chunks?: TranslatedChunk[] }>({
        prompt: { system: TRANSLATION_SYSTEM, user },
        config: { temperature: attempt === 0 ? 0.1 : 0, maxOutputTokens: 4096 },
      });

      const translated = applyTranslation(result.data, segments);

      ragDevLog('language:groq', {
        type: 'success',
        model: result.model,
        targetLanguage,
        segments: segments.length,
        attempt,
        latencyMs: Date.now() - startTime,
      });

      return translated;
    } catch (err) {
      // A rate limit will not be fixed by retrying here; surface it immediately.
      if (err instanceof AppError && err.status === 429) throw err;

      lastError = err;
      ragDevLog('language:groq', {
        type: 'attempt-failed',
        targetLanguage,
        segments: segments.length,
        attempt,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  ragDevLog('language:groq', {
    type: 'error',
    targetLanguage,
    segments: segments.length,
    errorMessage: lastError instanceof Error ? lastError.message : String(lastError),
  });

  throw new AppError(
    502,
    'Translation failed for part of this transcript. Please try again.',
    undefined,
    'TranslationFailed'
  );
}

export const transcriptTranslationService = {
  async translate(params: {
    videoId: string;
    targetLanguage: ResponseLanguageId;
    sourceLanguage?: string;
    chunks: TranscriptSegment[];
  }): Promise<{ chunks: TranscriptSegment[] }> {
    const { chunks, targetLanguage, sourceLanguage } = params;
    if (!chunks.length) return { chunks: [] };

    const batches = batchSegments(chunks);
    ragDevLog('language:groq', {
      type: 'translate-start',
      targetLanguage,
      segments: chunks.length,
      batches: batches.length,
    });

    // mapWithConcurrency preserves input order and caps simultaneous Groq calls.
    const translatedBatches = await mapWithConcurrency(batches, (batch) =>
      translateBatch(batch, targetLanguage, sourceLanguage)
    );

    return { chunks: translatedBatches.flat() };
  },

  async transformTextLanguage(params: {
    content: string;
    targetLanguage: ResponseLanguageId;
  }): Promise<{ content: string; model: string }> {
    const { content, targetLanguage } = params;
    if (!content.trim()) return { content: '', model: '' };

    const system = `You are the language transformation engine for YT StudyFlow.

Transform the provided study content into the requested language while preserving the original meaning, technical terminology, structure, questions, answers, lists, and important details.

Supported output modes:

* English: natural professional English
* Hindi: natural Hindi written in Devanagari
* Hinglish: natural Hindi written in Roman script with commonly used English technical terms

Do not add new information.
Do not summarize unless explicitly requested.
Do not remove important information.
Do not translate technical terms unnecessarily (keep RAG, embeddings, vector database, Pinecone, API, React, JavaScript, machine learning, etc. in English).
Return only the transformed content.`;

    const user = `Target Language Mode: ${targetLanguage}\n\nContent to transform:\n${content}`;
    const model = env.groqModel;
    const startTime = Date.now();

    ragDevLog('language:groq', {
      type: 'request',
      model,
      targetLanguage,
      inputChars: content.length,
    });

    try {
      const result = await groqService.generateText({
        model,
        prompt: { system, user },
        config: { temperature: 0.2, maxOutputTokens: 2500 },
      });

      const latencyMs = Date.now() - startTime;
      ragDevLog('language:groq', {
        type: 'success',
        model: result.model,
        targetLanguage,
        outputChars: result.content.length,
        latencyMs,
      });

      return { content: result.content, model: result.model };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      ragDevLog('language:groq', {
        type: 'error',
        model,
        targetLanguage,
        status: 500,
        errorMessage,
      });
      throw err;
    }
  },
};

