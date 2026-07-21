import { localization } from '../lib/localization.service.js';
import { geminiService } from './gemini.service.js';
import type { ResponseLanguageId } from '../lib/languages.js';
import { AppError } from '../utils/appError.js';

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
    if (!Array.isArray(parsed.chunks)) throw new Error('missing chunks');

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
    console.warn('[transcript-translation] Gemini translation parse failed', {
      error: err instanceof Error ? err.message : String(err),
      sourceCount: source.length,
      bodyPreview: raw.slice(0, 500),
    });
    throw new AppError(
      502,
      'Gemini translation returned an incomplete transcript. Please retry.',
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
    'Translate every lecture transcript segment. Preserve ordering, segment IDs, indexes, startTime, endTime, and duration exactly.',
    localization.transcriptTranslationPrompt(targetLanguage),
    'Translate the text field only. Do not summarize, shorten, merge, omit, or add segments.',
    'If text is already in the target language, rewrite it naturally in the same language without changing meaning.',
    'Return JSON only: {"chunks":[{"id":string,"text":string,"startTime":number,"endTime":number,"duration":number,"index":number}]}',
  ].join('\n');

  const user = [
    sourceLanguage ? `Source caption language: ${sourceLanguage}` : '',
    'Segments to translate (preserve id, startTime, endTime, duration, index):',
    JSON.stringify(segments),
  ]
    .filter(Boolean)
    .join('\n');

  const result = await geminiService.generateText({
    model: 'gemini-3.5-flash',
    prompt: { system, user },
    config: { temperature: 0.05, maxOutputTokens: 8192 },
  });

  return parseTranslationJson(result.content, segments);
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
};
