import { STORAGE_KEYS } from './constants';

import { isAuthenticated } from './api/auth';

import { AUTH_DISABLED } from './config/auth.config';
import type { ResponseLanguageId } from './languages';
import { DEFAULT_RESPONSE_LANGUAGE } from './languages';

export interface Settings {
  autoLoadTranscript: boolean;
  chatMode: 'concise' | 'deep' | 'interview';
  defaultNoteType: 'concise' | 'detailed' | 'interview' | 'revision';
  responseLanguage: ResponseLanguageId;
  theme: 'dark' | 'light';
}

const DEFAULT_SETTINGS: Settings = {
  autoLoadTranscript: true,
  chatMode: 'concise',
  defaultNoteType: 'concise',
  responseLanguage: DEFAULT_RESPONSE_LANGUAGE,
  theme: 'dark',
};



export async function getSettings(): Promise<Settings> {

  try {

    const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);

    return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] as Partial<Settings>) };

  } catch {

    return DEFAULT_SETTINGS;

  }

}



export async function saveSettings(settings: Partial<Settings>): Promise<void> {

  const current = await getSettings();

  await chrome.storage.sync.set({

    [STORAGE_KEYS.SETTINGS]: { ...current, ...settings },

  });

}



/** AI features require backend availability (auth temporarily bypassed). */

export async function canUseGeminiApi(): Promise<boolean> {

  // TODO: Re-enable isAuthenticated() check when AUTH_DISABLED is false.

  if (AUTH_DISABLED) return true;

  return isAuthenticated();

}



export async function canUseBackendAi(): Promise<boolean> {

  // TODO: Re-enable isAuthenticated() check when AUTH_DISABLED is false.

  if (AUTH_DISABLED) return true;

  return isAuthenticated();

}

