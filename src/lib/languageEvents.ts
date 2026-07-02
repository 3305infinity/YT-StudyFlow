import type { ResponseLanguageId } from '@lib/languages';

type LanguageChangeListener = (language: ResponseLanguageId, previous: ResponseLanguageId) => void;

const listeners = new Set<LanguageChangeListener>();

export function onLanguageChange(listener: LanguageChangeListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitLanguageChange(language: ResponseLanguageId, previous: ResponseLanguageId): void {
  for (const listener of listeners) {
    try {
      listener(language, previous);
    } catch (e) {
      console.warn('[YT StudyFlow] language change listener failed', e);
    }
  }
}
