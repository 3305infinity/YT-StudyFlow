import { useEffect } from 'react';
import { CheckCircle2, LogOut, Sparkles, User } from 'lucide-react';
import { useSettingsStore } from '@/store/settings.store';
import { useAuthStore } from '@/store/auth.store';
import { AUTH_DISABLED } from '@lib/config/auth.config';
import { LanguageSelector } from '@/components/LanguageSelector';
export function SettingsPanel() {
  const { chatMode, defaultNoteType, loaded, load, update } = useSettingsStore();
  const {
    user,
    loaded: authLoaded,
    signingIn,
    signInError,
    load: loadAuth,
    signIn,
    signOut,
    refreshProfile,
    clearSignInError,
  } = useAuthStore();

  useEffect(() => {
    void load();
    void loadAuth();
  }, [load, loadAuth]);

  useEffect(() => {
    if (!signingIn) return undefined;
    const id = window.setInterval(() => void refreshProfile(), 1500);
    return () => window.clearInterval(id);
  }, [signingIn, refreshProfile]);

  return (
    <div className="space-y-4 overflow-y-auto p-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-2 text-white">
          <User className="h-4 w-4 text-indigo-300" />
          <h3 className="text-sm font-semibold">Account</h3>
        </div>

        {!authLoaded ? (
          <p className="mt-3 text-xs text-white/45">Loading account…</p>
        ) : AUTH_DISABLED ? (
          /* TODO: Re-enable Clerk account UI when AUTH_DISABLED is false. */
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500/20 ring-2 ring-indigo-400/20">
                <User className="h-5 w-5 text-indigo-100" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{user?.name ?? 'Guest'}</p>
                <p className="text-xs text-white/50">Authentication temporarily disabled</p>
              </div>
            </div>
            <p className="text-[11px] leading-5 text-white/45">
              All AI features are available without sign-in. Clerk auth code is preserved for future re-enable.
            </p>
          </div>
        ) : user ? (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3">
              {user.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt=""
                  className="h-11 w-11 rounded-full ring-2 ring-emerald-400/30 object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-400/20">
                  <User className="h-5 w-5 text-emerald-100" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs font-medium">Signed in</span>
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-white">
                  {user.name || user.email || user.userId}
                </p>
                {user.email && user.name && (
                  <p className="truncate text-xs text-white/50">{user.email}</p>
                )}
              </div>
            </div>

            {signInError && (
              <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {signInError}
              </p>
            )}

            {user.usage && (
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-white/40">AI usage today</p>
                <p className="mt-1 text-sm font-medium text-white">
                  {user.usage.remaining} of {user.usage.limit} requests left
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400"
                    style={{
                      width: `${Math.min(100, (user.usage.used / Math.max(user.usage.limit, 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => void signOut()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80 hover:bg-white/8"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        ) : (
          /* TODO: Re-enable Google sign-in button when AUTH_DISABLED is false. */
          <div className="mt-3 space-y-3">
            <p className="text-xs leading-5 text-white/55">
              Sign in with Google to unlock AI chat, notes, quizzes, and cloud sync across devices.
            </p>

            {signInError && (
              <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5">
                <p className="text-xs leading-5 text-red-100">{signInError}</p>
                <button
                  type="button"
                  onClick={clearSignInError}
                  className="mt-2 text-[11px] text-red-200/80 underline underline-offset-2 hover:text-red-100"
                >
                  Dismiss
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => void signIn()}
              disabled={signingIn}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-gray-900 shadow-sm hover:bg-white/95 disabled:opacity-60"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {signingIn ? 'Complete sign-in in the popup…' : 'Continue with Google'}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-300" />
          <h3 className="text-sm font-semibold text-white">Preferences</h3>
        </div>

        {!loaded ? (
          <p className="text-xs text-white/45">Loading preferences…</p>
        ) : (
          <>
            <LanguageSelector variant="full" />
            <p className="text-[11px] leading-5 text-white/40">
              Global application language for chat, notes, quizzes, flashcards, study plans,
              summaries, and transcript translation. Change it once in the header or here.
            </p>
            <label className="block text-xs text-white/55">
              Default chat mode
              <select
                value={chatMode}
                onChange={(e) => update({ chatMode: e.target.value as typeof chatMode })}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-indigo-400/40 focus:outline-none"
              >
                <option value="concise">Concise</option>
                <option value="deep">Deep</option>
                <option value="interview">Interview</option>
              </select>
            </label>

            <label className="block text-xs text-white/55">
              Default note type
              <select
                value={defaultNoteType}
                onChange={(e) =>
                  update({ defaultNoteType: e.target.value as typeof defaultNoteType })
                }
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-indigo-400/40 focus:outline-none"
              >
                <option value="concise">Concise</option>
                <option value="detailed">Detailed</option>
                <option value="interview">Interview</option>
                <option value="revision">Revision</option>
              </select>
            </label>
          </>
        )}
      </section>
    </div>
  );
}
