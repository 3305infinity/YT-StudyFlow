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
    <section className="rounded-lg border border-line bg-surface-raised/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 rounded-lg"
      >
        <span className="text-[13px] font-semibold uppercase tracking-wider text-content">
          {title}
        </span>
        <span className="flex items-center gap-2">
          {badge && (
            <span className="rounded-md bg-surface-overlay px-2 py-0.5 text-[11.5px] font-medium text-content-muted">
              {badge}
            </span>
          )}
          <ChevronDown
            className={twMerge(
              clsx('h-3.5 w-3.5 text-content-subtle transition-transform', open && 'rotate-180')
            )}
          />
        </span>
      </button>
      {open && <div className="border-t border-line px-3 py-3">{children}</div>}
    </section>
  );
}
