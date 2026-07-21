import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useLayoutEffect, useRef, useState } from 'react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  disabled?: boolean;
  badge?: string;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useLayoutEffect(() => {
    const btn = btnRefs.current[value];
    const list = listRef.current;
    if (!btn || !list) return;
    const bRect = btn.getBoundingClientRect();
    const lRect = list.getBoundingClientRect();
    setIndicator({ left: bRect.left - lRect.left, width: bRect.width });
  }, [value, items]);

  return (
    <div
      ref={listRef}
      className={twMerge(
        clsx(
          'relative flex gap-1 overflow-x-auto rounded-md border border-line bg-surface p-1',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        ),
        className
      )}
      role="tablist"
    >
      {/* Animated active indicator (brand gradient pill). */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 rounded-[7px] bg-brand-gradient shadow-cta transition-all duration-170 ease-out"
        style={{ left: indicator.left, width: indicator.width }}
      />

      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              btnRefs.current[item.id] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) onChange(item.id);
            }}
            className={twMerge(
              clsx(
                'relative z-10 shrink-0 rounded-[7px] px-3 py-1.5 text-label font-medium transition-colors duration-170 ease-out',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/45',
                active
                  ? 'text-white'
                  : 'text-content-subtle hover:text-content-muted',
                item.disabled && 'cursor-not-allowed opacity-40'
              )
            )}
          >
            {item.label}
            {item.badge && (
              <span className="ml-1 rounded bg-black/20 px-1 py-0.5 text-[9px] text-white/80">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
