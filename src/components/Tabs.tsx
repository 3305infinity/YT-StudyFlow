import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  return (
    <div
      className={twMerge(
        clsx(
          'flex gap-0.5 overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900/50 p-0.5',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        ),
        className
      )}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => {
              if (!item.disabled) onChange(item.id);
            }}
            className={twMerge(
              clsx(
                'relative shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40',
                active ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-neutral-300',
                item.disabled && 'opacity-40 cursor-not-allowed'
              )
            )}
          >
            {item.label}
            {item.badge && (
              <span className="ml-1 rounded bg-neutral-700 px-1 py-0.5 text-[9px]">{item.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
