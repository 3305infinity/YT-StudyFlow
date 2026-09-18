import { ensureDbReady, getDb } from './db';
import type { ResponseLanguageId } from './languages';
import { api } from './api/client';

export type NoteLanguageCacheRow = {
  id: string; // noteId:language
  noteId: string;
  language: ResponseLanguageId;
  content: string;
  updatedAt: number;
};

function cacheKey(noteId: string, language: ResponseLanguageId): string {
  return `${noteId}:${language}`;
}

export async function getCachedNoteLanguage(
  noteId: string,
  language: ResponseLanguageId
): Promise<string | null> {
  if (language === 'en') return null; // English is the original base note content
  try {
    await ensureDbReady();
    const key = cacheKey(noteId, language);
    const row = await getDb().transcriptTranslations.get(key) as unknown as NoteLanguageCacheRow | undefined;
    return row?.content ?? null;
  } catch {
    return null;
  }
}

export async function setCachedNoteLanguage(
  noteId: string,
  language: ResponseLanguageId,
  content: string
): Promise<void> {
  if (language === 'en' || !content.trim()) return;
  try {
    await ensureDbReady();
    const key = cacheKey(noteId, language);
    await getDb().transcriptTranslations.put({
      id: key,
      videoId: noteId,
      targetLanguage: language,
      chunks: [{ id: '1', text: content, startTime: 0, endTime: 0, duration: 0, index: 0 }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as unknown as import('./db').TranscriptTranslationRow);
  } catch (err) {
    console.warn('[noteLanguageCache] Failed to save note translation cache', err);
  }
}

export async function invalidateNoteLanguageCache(noteId: string): Promise<void> {
  try {
    await ensureDbReady();
    const languages: ResponseLanguageId[] = ['hi', 'hinglish'];
    for (const lang of languages) {
      const key = cacheKey(noteId, lang);
      await getDb().transcriptTranslations.delete(key);
    }
  } catch {
    // ignore deletion errors
  }
}

export async function transformContentLanguage(params: {
  noteId: string;
  content: string;
  targetLanguage: ResponseLanguageId;
}): Promise<string> {
  const { noteId, content, targetLanguage } = params;
  if (targetLanguage === 'en' || !content.trim()) return content;

  // 1. Check local cache first
  const cached = await getCachedNoteLanguage(noteId, targetLanguage);
  if (cached) {
    return cached;
  }

  // 2. Call backend Groq transformation route
  const response = await api.post<{ content: string; model: string }>('/api/ai/transform-language', {
    content,
    targetLanguage,
  });

  const transformed = response.content;

  // 3. Save to local cache
  if (transformed) {
    await setCachedNoteLanguage(noteId, targetLanguage, transformed);
  }

  return transformed;
}
