import type { ReactNode } from 'react';

export function WorkspaceShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-neutral-950 text-neutral-100">
      <header className="shrink-0 border-b border-neutral-800 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-white">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
