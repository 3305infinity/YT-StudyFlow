import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  badge,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded-lg"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
          {title}
        </span>
        <span className="flex items-center gap-2">
          {badge && (
            <span className="rounded-md bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">
              {badge}
            </span>
          )}
          <ChevronDown
            className={twMerge(
              clsx('h-3.5 w-3.5 text-neutral-500 transition-transform', open && 'rotate-180')
            )}
          />
        </span>
      </button>
      {open && <div className="border-t border-neutral-800 px-3 py-3">{children}</div>}
    </section>
  );
}
