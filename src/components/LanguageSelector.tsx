import { Languages } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useSettingsStore } from '@/store/settings.store';
import { UI_LANGUAGES, languageLabel } from '@lib/localization.service';
import type { ResponseLanguageId } from '@lib/languages';

type LanguageSelectorProps = {
  variant?: 'compact' | 'full';
  className?: string;
  showLabel?: boolean;
};

export function LanguageSelector({
  variant = 'compact',
  className,
  showLabel = false,
}: LanguageSelectorProps) {
  const responseLanguage = useSettingsStore((s) => s.responseLanguage);
  const loaded = useSettingsStore((s) => s.loaded);
  const update = useSettingsStore((s) => s.update);

  if (!loaded) return null;

  if (variant === 'full') {
    return (
      <label className={twMerge(clsx('block text-xs text-white/55', className))}>
        Application language
        <select
          value={responseLanguage}
          onChange={(e) =>
            void update({ responseLanguage: e.target.value as ResponseLanguageId })
          }
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-indigo-400/40 focus:outline-none"
        >
          {UI_LANGUAGES.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {lang.label} ({lang.nativeLabel})
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div
      className={twMerge(
        clsx(
          'flex items-center gap-1.5 rounded-lg border border-neutral-800 px-2 py-1 text-[10px] text-neutral-400',
          className
        )
      )}
      title={`AI language: ${languageLabel(responseLanguage)}`}
    >
      <Languages className="h-3 w-3 shrink-0" />
      {showLabel && <span className="hidden sm:inline">Language</span>}
      <select
        value={responseLanguage}
        onChange={(e) =>
          void update({ responseLanguage: e.target.value as ResponseLanguageId })
        }
        aria-label="Application language"
        className="max-w-[6.5rem] truncate bg-transparent text-[10px] text-neutral-300 focus:outline-none"
      >
        {UI_LANGUAGES.map((lang) => (
          <option key={lang.id} value={lang.id} className="bg-neutral-900">
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function LanguageBadge({ className }: { className?: string }) {
  const responseLanguage = useSettingsStore((s) => s.responseLanguage);
  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1 rounded-md border border-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400',
          className
        )
      )}
    >
      <Languages className="h-3 w-3" />
      {languageLabel(responseLanguage)}
    </span>
  );
}
