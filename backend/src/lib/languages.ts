export type ResponseLanguageId =
  | 'en'
  | 'hi'
  | 'hinglish'
  | 'es'
  | 'fr'
  | 'de'
  | 'ja'
  | 'zh'
  | 'ko';

export type ResponseLanguage = {
  id: ResponseLanguageId;
  label: string;
  nativeLabel: string;
};

export const INITIAL_RESPONSE_LANGUAGES: ResponseLanguage[] = [
  { id: 'en', label: 'English', nativeLabel: 'English' },
  { id: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { id: 'hinglish', label: 'Hinglish', nativeLabel: 'Hinglish' },
];

export const RESPONSE_LANGUAGES: ResponseLanguage[] = [
  ...INITIAL_RESPONSE_LANGUAGES,
  { id: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { id: 'fr', label: 'French', nativeLabel: 'Français' },
  { id: 'de', label: 'German', nativeLabel: 'Deutsch' },
  { id: 'ja', label: 'Japanese', nativeLabel: '日本語' },
  { id: 'zh', label: 'Chinese', nativeLabel: '中文' },
  { id: 'ko', label: 'Korean', nativeLabel: '한국어' },
];

export const DEFAULT_RESPONSE_LANGUAGE: ResponseLanguageId = 'en';

const LANGUAGE_GUIDANCE: Record<ResponseLanguageId, string> = {
  en: 'Write the entire response in clear English.',
  hi: 'Write the entire response in Hindi (Devanagari script).',
  hinglish:
    'Write the entire response in Hinglish — natural Hindi-English mix as spoken in India (Roman script for English words, Devanagari optional for Hindi).',
  es: 'Write the entire response in Spanish.',
  fr: 'Write the entire response in French.',
  de: 'Write the entire response in German.',
  ja: 'Write the entire response in Japanese.',
  zh: 'Write the entire response in Simplified Chinese.',
  ko: 'Write the entire response in Korean.',
};

export function normalizeLanguageId(value: string | undefined): ResponseLanguageId {
  const id = (value ?? DEFAULT_RESPONSE_LANGUAGE) as ResponseLanguageId;
  return RESPONSE_LANGUAGES.some((l) => l.id === id) ? id : DEFAULT_RESPONSE_LANGUAGE;
}

export function languageLabel(id: ResponseLanguageId): string {
  return RESPONSE_LANGUAGES.find((l) => l.id === id)?.label ?? 'English';
}

export function languageInstruction(languageId: ResponseLanguageId = DEFAULT_RESPONSE_LANGUAGE): string {
  const guidance = LANGUAGE_GUIDANCE[normalizeLanguageId(languageId)];
  return [
    'LANGUAGE (mandatory):',
    `- You must answer entirely in the user's selected language.`,
    `- ${guidance}`,
    '- Do not switch languages unless the user explicitly asks.',
    '- Proper nouns (product names, algorithms, company names) may stay as commonly written.',
    '- Generate content directly in the selected language — do not write in English and translate afterward.',
    '- Translate transcript content into the selected language when explaining.',
  ].join('\n');
}

export function transcriptTranslationInstruction(
  languageId: ResponseLanguageId = DEFAULT_RESPONSE_LANGUAGE
): string {
  const guidance = LANGUAGE_GUIDANCE[normalizeLanguageId(languageId)];
  return [
    'TRANSCRIPT TRANSLATION (mandatory):',
    `- ${guidance}`,
    '- Translate each segment text only — preserve startTime, endTime, id, and index exactly.',
    '- Keep paragraph grouping and ordering identical to the source.',
    '- Do not merge or split segments.',
    '- Return valid JSON only.',
  ].join('\n');
}

/** @deprecated Use languageInstruction() */
export const ENGLISH_OUTPUT_RULE = languageInstruction('en');
