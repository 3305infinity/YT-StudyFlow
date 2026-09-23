import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface LoaderProps {
  className?: string;
  label?: string;
}

export function Loader({ className, label }: LoaderProps) {
  return (
    <div className={twMerge(clsx('flex items-center gap-2 text-content-muted'), className)}>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
