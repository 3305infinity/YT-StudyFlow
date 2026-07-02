/**
 * Backend mirror of frontend localization.service.ts
 */
import {
  DEFAULT_RESPONSE_LANGUAGE,
  languageInstruction,
  languageLabel,
  normalizeLanguageId,
  transcriptTranslationInstruction,
  type ResponseLanguageId,
} from './languages.js';

export type { ResponseLanguageId };

export const localization = {
  defaultLanguage: DEFAULT_RESPONSE_LANGUAGE,

  normalize(id: string | undefined): ResponseLanguageId {
    return normalizeLanguageId(id);
  },

  label(id: ResponseLanguageId): string {
    return languageLabel(id);
  },

  promptInstruction(languageId?: ResponseLanguageId): string {
    return languageInstruction(normalizeLanguageId(languageId));
  },

  transcriptTranslationPrompt(languageId: ResponseLanguageId): string {
    return transcriptTranslationInstruction(languageId);
  },
};

export { languageInstruction, languageLabel, normalizeLanguageId };
