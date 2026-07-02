/**
 * Central localization utility for AI-generated content.
 * Every Gemini prompt should use this service — never duplicate language logic.
 */
import {
  DEFAULT_RESPONSE_LANGUAGE,
  INITIAL_RESPONSE_LANGUAGES,
  languageInstruction,
  languageLabel,
  normalizeLanguageId,
  transcriptTranslationInstruction,
  type ResponseLanguageId,
} from './languages';

export type { ResponseLanguageId };

/** Languages shown in UI selectors (extensible — add IDs to INITIAL_RESPONSE_LANGUAGES). */
export const UI_LANGUAGES = INITIAL_RESPONSE_LANGUAGES;

export const localization = {
  defaultLanguage: DEFAULT_RESPONSE_LANGUAGE,

  normalize(id: string | undefined): ResponseLanguageId {
    return normalizeLanguageId(id);
  },

  label(id: ResponseLanguageId): string {
    return languageLabel(id);
  },

  /** Mandatory block for every Gemini system prompt. */
  promptInstruction(languageId?: ResponseLanguageId): string {
    return languageInstruction(normalizeLanguageId(languageId));
  },

  /** Instruction for transcript translation prompts. */
  transcriptTranslationPrompt(languageId: ResponseLanguageId): string {
    return transcriptTranslationInstruction(languageId);
  },

  /** Read language from settings store shape. */
  fromSettings(settings: { responseLanguage?: ResponseLanguageId }): ResponseLanguageId {
    return normalizeLanguageId(settings.responseLanguage);
  },
};

export {
  languageInstruction,
  languageLabel,
  normalizeLanguageId,
  DEFAULT_RESPONSE_LANGUAGE,
  INITIAL_RESPONSE_LANGUAGES,
};
