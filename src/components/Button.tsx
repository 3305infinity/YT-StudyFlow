import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'icon';
  loading?: boolean;
}

export function Button({
  className,
  variant = 'ghost',
  size = 'md',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={twMerge(
        clsx(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium',
          'transition-colors duration-170 ease-out',
          'outline-none focus-visible:ring-2 focus-visible:ring-brand/45',
          'disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none',
          variant === 'primary' &&
            'bg-brand-gradient text-white shadow-cta hover:opacity-90',
          variant === 'secondary' &&
            'border border-line-strong bg-surface-overlay text-content hover:bg-line-soft',
          variant === 'ghost' && 'text-content-muted hover:bg-surface-overlay hover:text-content',
          variant === 'outline' &&
            'border border-line text-content-muted hover:bg-surface-overlay hover:text-content',
          variant === 'danger' &&
            'border border-danger-border bg-danger-soft text-danger hover:bg-danger/20',
          size === 'sm' && 'px-2.5 py-1.5 text-label',
          size === 'md' && 'px-3 py-2 text-body',
          size === 'icon' && 'p-2'
        ),
        className
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
