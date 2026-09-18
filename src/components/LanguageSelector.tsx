import { useState, useRef, useEffect } from 'react';
import { Languages, Check, ChevronDown } from 'lucide-react';
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
  showLabel = true,
}: LanguageSelectorProps) {
  const responseLanguage = useSettingsStore((s) => s.responseLanguage);
  const loaded = useSettingsStore((s) => s.loaded);
  const update = useSettingsStore((s) => s.update);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!loaded) return null;

  const currentLangObj = UI_LANGUAGES.find((l) => l.id === responseLanguage) || UI_LANGUAGES[0]!;

  const handleSelect = (id: ResponseLanguageId) => {
    void update({ responseLanguage: id });
    setOpen(false);
  };

  if (variant === 'full') {
    return (
      <div className={twMerge(clsx('space-y-1.5', className))} ref={dropdownRef}>
        <span className="block text-xs font-medium text-content-subtle">Response Language</span>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-content hover:border-line-strong hover:bg-surface-raised focus:outline-none focus:ring-1 focus:ring-brand/40"
          >
            <span className="flex items-center gap-2">
              <Languages className="h-4 w-4 text-brand-muted" />
              <span>{currentLangObj.label} ({currentLangObj.nativeLabel})</span>
            </span>
            <ChevronDown className="h-4 w-4 text-content-subtle" />
          </button>

          {open && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-line bg-surface-raised p-1 shadow-2">
              {UI_LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => handleSelect(lang.id)}
                  className={clsx(
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition-colors',
                    responseLanguage === lang.id
                      ? 'bg-brand/15 text-brand font-semibold'
                      : 'text-content-muted hover:bg-surface-overlay hover:text-content'
                  )}
                >
                  <span>{lang.label} ({lang.nativeLabel})</span>
                  {responseLanguage === lang.id && <Check className="h-3.5 w-3.5 text-brand" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={twMerge(clsx('relative inline-block text-left', className))} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Select response language"
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-xs font-medium text-content transition-all hover:border-line-strong hover:bg-surface-overlay focus:outline-none focus:ring-1 focus:ring-brand/40"
      >
        <Languages className="h-3.5 w-3.5 text-brand" />
        {showLabel && <span>{currentLangObj.label}</span>}
        <ChevronDown className={clsx('h-3 w-3 text-content-subtle transition-transform duration-170', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-40 rounded-lg border border-line bg-surface-overlay p-1 shadow-2">
          {UI_LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              type="button"
              onClick={() => handleSelect(lang.id)}
              className={clsx(
                'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                responseLanguage === lang.id
                  ? 'bg-brand/15 text-brand font-semibold'
                  : 'text-content-muted hover:bg-surface-raised hover:text-content'
              )}
            >
              <span>{lang.label}</span>
              {responseLanguage === lang.id && <Check className="h-3.5 w-3.5 text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function LanguageBadge({ className }: { className?: string }) {
  const responseLanguage = useSettingsStore((s) => s.responseLanguage);
  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-2.5 py-1 text-xs font-medium text-content-muted',
          className
        )
      )}
    >
      <Languages className="h-3.5 w-3.5 text-brand" />
      {languageLabel(responseLanguage)}
    </span>
  );
}

