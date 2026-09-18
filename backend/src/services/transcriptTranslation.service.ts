import { localization } from '../lib/localization.service.js';
import { groqService } from './groq.service.js';
import type { ResponseLanguageId } from '../lib/languages.js';
import { AppError } from '../utils/appError.js';
import { ragDevLog } from './rag/devLog.js';

type TranscriptSegment = {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  duration: number;
  index: number;
};

const BATCH_SIZE = 12;

function parseTranslationJson(raw: string, source: TranscriptSegment[]): TranscriptSegment[] {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch?.[0] ?? trimmed;

  try {
    const parsed = JSON.parse(candidate) as { chunks?: TranscriptSegment[] };
    if (!Array.isArray(parsed.chunks)) throw new Error('missing chunks array');

    const byId = new Map(parsed.chunks.map((c) => [c.id, c]));
    const missing = source.filter((seg) => !byId.has(seg.id));
    if (missing.length) {
      throw new Error(`missing translated segments: ${missing.map((s) => s.id).join(', ')}`);
    }

    return source.map((seg) => {
      const translated = byId.get(seg.id);
      if (!translated?.text?.trim()) {
        throw new Error(`empty translated text for segment ${seg.id}`);
      }
      return {
        ...seg,
        text: translated.text.trim(),
      };
    });
  } catch (err) {
    ragDevLog('language:groq', {
      type: 'parse-failed',
      error: err instanceof Error ? err.message : String(err),
      sourceCount: source.length,
    });
    throw new AppError(
      502,
      'Groq translation returned an incomplete structure. Please retry.',
      undefined,
      'TranslationParseFailed'
    );
  }
}

async function translateBatch(
  segments: TranscriptSegment[],
  targetLanguage: ResponseLanguageId,
  sourceLanguage?: string
): Promise<TranscriptSegment[]> {
  const system = [
    'You are the language transformation engine for YT StudyFlow.',
    'Translate every lecture transcript segment while preserving ordering, segment IDs, indexes, startTime, endTime, and duration exactly.',
    localization.transcriptTranslationPrompt(targetLanguage),
    'Translate the text field only. Do not summarize, shorten, merge, omit, or add segments.',
    'Do not translate technical terms unnecessarily (keep RAG, embeddings, vector database, Pinecone, API, React, etc. in English).',
    'Return JSON only: {"chunks":[{"id":string,"text":string,"startTime":number,"endTime":number,"duration":number,"index":number}]}',
  ].join('\n');

  const user = [
    sourceLanguage ? `Source caption language: ${sourceLanguage}` : '',
    'Segments to translate:',
    JSON.stringify(segments),
  ]
    .filter(Boolean)
    .join('\n');

  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const startTime = Date.now();

  ragDevLog('language:groq', {
    type: 'request',
    model,
    targetLanguage,
    inputChars: user.length,
  });

  try {
    const result = await groqService.generateText({
      model,
      prompt: { system, user },
      config: { temperature: 0.1, maxOutputTokens: 4096 },
    });

    const latencyMs = Date.now() - startTime;
    ragDevLog('language:groq', {
      type: 'success',
      model: result.model,
      targetLanguage,
      outputChars: result.content.length,
      latencyMs,
    });

    return parseTranslationJson(result.content, segments);
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

    const translated: TranscriptSegment[] = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const result = await translateBatch(batch, targetLanguage, sourceLanguage);
      translated.push(...result);
    }

    return { chunks: translated };
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
    const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
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

