import type { ResponseLanguageId } from '@lib/languages';
import { localization } from '@lib/localization.service';
import type { EnhancedTranscriptChunk } from '@/types/transcript';
import { ensureDbReady, getDb, nowMs } from '@lib/db';
import { api } from '@lib/api/client';
import { canUseGeminiApi } from '@lib/storage';

export type TranscriptTranslationRow = {
  id: string;
  videoId: string;
  targetLanguage: ResponseLanguageId;
  chunks: Array<{
    id: string;
    text: string;
    startTime: number;
    endTime: number;
    duration: number;
    index: number;
  }>;
  createdAt: number;
  updatedAt: number;
};

function translationId(videoId: string, targetLanguage: ResponseLanguageId): string {
  return `translation|${videoId}|${targetLanguage}`;
}

export async function getCachedTranslation(
  videoId: string,
  targetLanguage: ResponseLanguageId
): Promise<EnhancedTranscriptChunk[] | null> {
  await ensureDbReady();
  const row = await getDb().transcriptTranslations.get(translationId(videoId, targetLanguage));
  if (!row) return null;
  return row.chunks.map((c) => ({
    ...c,
    start: c.startTime,
    end: c.endTime,
  }));
}

export async function clearTranslationCacheForVideo(
  videoId: string,
  targetLanguage?: ResponseLanguageId
): Promise<void> {
  await ensureDbReady();
  if (targetLanguage) {
    await getDb().transcriptTranslations.delete(translationId(videoId, targetLanguage));
    return;
  }
  const prefix = `translation|${videoId}|`;
  const rows = await getDb().transcriptTranslations.where('videoId').equals(videoId).toArray();
  await Promise.all(rows.map((r) => getDb().transcriptTranslations.delete(r.id)));
  void prefix;
}

async function saveTranslation(
  videoId: string,
  targetLanguage: ResponseLanguageId,
  chunks: EnhancedTranscriptChunk[]
): Promise<void> {
  await ensureDbReady();
  const ts = nowMs();
  const row: TranscriptTranslationRow = {
    id: translationId(videoId, targetLanguage),
    videoId,
    targetLanguage,
    chunks: chunks.map((c) => ({
      id: c.id,
      text: c.text,
      startTime: c.start,
      endTime: c.end,
      duration: c.duration ?? c.end - c.start,
      index: c.index,
    })),
    createdAt: ts,
    updatedAt: ts,
  };
  await getDb().transcriptTranslations.put(row);
}

type TranslateApiResponse = {
  chunks: Array<{
    id: string;
    text: string;
    startTime: number;
    endTime: number;
    duration: number;
    index: number;
  }>;
};

export async function translateTranscript(params: {
  videoId: string;
  sourceChunks: EnhancedTranscriptChunk[];
  targetLanguage: ResponseLanguageId;
  sourceLanguage?: string;
}): Promise<EnhancedTranscriptChunk[]> {
  const { videoId, sourceChunks, targetLanguage } = params;
  if (!sourceChunks.length) return [];

  const cached = await getCachedTranslation(videoId, targetLanguage);
  if (
    cached &&
    cached.length === sourceChunks.length &&
    cached.every((chunk, idx) => chunk.id === sourceChunks[idx]?.id)
  ) {
    return cached;
  }
  if (cached) {
    await clearTranslationCacheForVideo(videoId, targetLanguage);
  }

  if (!(await canUseGeminiApi())) {
    throw new Error('AI translation is unavailable. Sign in or configure backend AI, then retry.');
  }

  const response = await api.post<TranslateApiResponse>('/api/transcript/translate', {
    videoId,
    targetLanguage,
    sourceLanguage: params.sourceLanguage,
    chunks: sourceChunks.map((c) => ({
      id: c.id,
      text: c.text,
      startTime: c.start,
      endTime: c.end,
      duration: c.duration ?? c.end - c.start,
      index: c.index,
    })),
  });

  const translated: EnhancedTranscriptChunk[] = response.chunks.map((c) => ({
    id: c.id,
    text: c.text,
    start: c.startTime,
    end: c.endTime,
    startTime: c.startTime,
    endTime: c.endTime,
    duration: c.duration,
    index: c.index,
  }));

  if (
    translated.length !== sourceChunks.length ||
    translated.some((chunk, idx) => chunk.id !== sourceChunks[idx]?.id)
  ) {
    throw new Error('Translation response did not preserve every transcript segment.');
  }

  await saveTranslation(videoId, targetLanguage, translated);
  return translated;
}

export function buildTranscriptTranslationPrompt(targetLanguage: ResponseLanguageId): string {
  return [
    'Translate every lecture transcript segment while preserving timestamps, order, ids, and indexes.',
    localization.transcriptTranslationPrompt(targetLanguage),
    'Return JSON only: {"chunks":[{"id":string,"text":string,"startTime":number,"endTime":number,"duration":number,"index":number}]}',
    'Translate only the text field. Do not summarize, merge, omit, or add segments.',
  ].join('\n');
}
