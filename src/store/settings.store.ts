import { create } from 'zustand';
import { getSettings, saveSettings, type Settings } from '@lib/storage';
import { DEFAULT_RESPONSE_LANGUAGE } from '@lib/languages';
import type { ResponseLanguageId } from '@lib/languages';
import { emitLanguageChange } from '@lib/languageEvents';
import { handleGlobalLanguageChange } from '@lib/languageEffects.service';

interface SettingsState extends Settings {
  loaded: boolean;
  load: () => Promise<void>;
  update: (partial: Partial<Settings>) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  autoLoadTranscript: true,
  chatMode: 'concise',
  defaultNoteType: 'concise',
  responseLanguage: DEFAULT_RESPONSE_LANGUAGE,
  theme: 'dark',
  loaded: false,

  load: async () => {
    const s = await getSettings();
    set({ ...s, loaded: true });
  },

  toggleTheme: async () => {
    const current = get().theme;
    const next = current === 'dark' ? 'light' : 'dark';
    await saveSettings({ theme: next });
    set({ theme: next });
  },

  update: async (partial) => {
    const previous = get().responseLanguage;
    await saveSettings(partial);
    set(partial);

    if (partial.responseLanguage && partial.responseLanguage !== previous) {
      const next = partial.responseLanguage as ResponseLanguageId;
      emitLanguageChange(next, previous);
      void handleGlobalLanguageChange(next, previous);
    }
  },
}));
