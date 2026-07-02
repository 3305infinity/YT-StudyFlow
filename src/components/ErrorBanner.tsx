import { AlertCircle, RefreshCw } from 'lucide-react';

export type ErrorAction = {
  label: string;
  onClick: () => void;
};

export function ErrorBanner({
  message,
  actions,
}: {
  message: string;
  actions?: ErrorAction[];
}) {
  return (
    <div
      className="mx-4 mb-2 flex items-start gap-2.5 rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2.5"
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-relaxed text-red-100">{message}</p>
        {actions && actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                className="inline-flex items-center gap-1 rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-100 hover:bg-red-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
              >
                <RefreshCw className="h-3 w-3" />
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
