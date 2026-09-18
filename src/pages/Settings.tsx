import { useEffect, useState } from 'react';
import { CheckCircle2, LogOut, Sparkles, User, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';
import { useSettingsStore } from '@/store/settings.store';
import { useAuthStore } from '@/store/auth.store';
import { LanguageSelector } from '@/components/LanguageSelector';

export function SettingsPanel() {
  const { chatMode, defaultNoteType, theme, loaded, load, update } = useSettingsStore();
  const {
    user,
    loaded: authLoaded,
    authenticating,
    authError,
    load: loadAuth,
    login,
    signup,
    signOut,
    clearAuthError,
  } = useAuthStore();

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    void loadAuth();
  }, [load, loadAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (!email.trim() || !password) {
      setLocalError('Please fill in all required fields.');
      return;
    }

    if (authMode === 'signup') {
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        return;
      }
      try {
        await signup({ name, email, password, confirmPassword });
        setName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      } catch {
        // handled in store
      }
    } else {
      try {
        await login({ email, password });
        setEmail('');
        setPassword('');
      } catch {
        // handled in store
      }
    }
  };

  return (
    <div className="space-y-4 overflow-y-auto p-4 font-sans text-content">
      {/* ---------- Account Section ---------- */}
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-1">
        <div className="flex items-center gap-2 mb-3">
          <User className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-semibold text-content">Account & Authentication</h3>
        </div>

        {!authLoaded ? (
          <div className="flex items-center gap-2 py-4 text-xs text-content-subtle">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Checking authentication status…</span>
          </div>
        ) : user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-base">
                {(user.name || user.email || 'U')[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-xs font-semibold">Signed in</span>
                </div>
                <p className="mt-0.5 truncate text-sm font-bold text-content">
                  {user.name || 'User'}
                </p>
                {user.email && (
                  <p className="truncate text-xs text-content-subtle">{user.email}</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void signOut()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-xs font-medium text-content hover:bg-surface-overlay hover:text-danger transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Form Toggle: Login vs Signup */}
            <div className="flex rounded-lg border border-line bg-surface-raised p-0.5">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setLocalError(null);
                  clearAuthError();
                }}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                  authMode === 'login'
                    ? 'bg-brand text-white shadow-cta'
                    : 'text-content-muted hover:text-content'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setLocalError(null);
                  clearAuthError();
                }}
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                  authMode === 'signup'
                    ? 'bg-brand text-white shadow-cta'
                    : 'text-content-muted hover:text-content'
                }`}
              >
                Sign Up
              </button>
            </div>

            {(localError || authError) && (
              <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1 leading-snug">{localError || authError}</div>
              </div>
            )}

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2.5">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-[11px] font-medium text-content-subtle mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-content-subtle" />
                    <input
                      type="text"
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border border-line bg-surface-raised pl-9 pr-3 py-2 text-xs text-content focus:border-brand focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-content-subtle mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-content-subtle" />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface-raised pl-9 pr-3 py-2 text-xs text-content focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-content-subtle mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-content-subtle" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface-raised pl-9 pr-3 py-2 text-xs text-content focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              {authMode === 'signup' && (
                <div>
                  <label className="block text-[11px] font-medium text-content-subtle mb-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-content-subtle" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-line bg-surface-raised pl-9 pr-3 py-2 text-xs text-content focus:border-brand focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={authenticating}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-xs font-bold text-white shadow-cta hover:opacity-95 disabled:opacity-50 transition-all mt-3"
              >
                {authenticating && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{authMode === 'login' ? 'Log In' : 'Create Account'}</span>
              </button>
            </form>
          </div>
        )}
      </section>

      {/* ---------- Preferences Section ---------- */}
      <section className="rounded-2xl border border-line bg-surface p-4 space-y-3 shadow-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-semibold text-content">Preferences</h3>
        </div>

        {!loaded ? (
          <p className="text-xs text-content-subtle">Loading preferences…</p>
        ) : (
          <>
            <LanguageSelector variant="full" />
            <p className="text-[11px] leading-5 text-content-subtle">
              Global application language for chat, notes, quizzes, flashcards, and transcript translation.
            </p>

            <label className="block text-xs font-medium text-content-subtle">
              Theme Mode
              <select
                value={theme}
                onChange={(e) => update({ theme: e.target.value as 'dark' | 'light' })}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface-raised px-3 py-2 text-xs text-content focus:border-brand focus:outline-none"
              >
                <option value="dark">Dark Mode</option>
                <option value="light">Light Mode</option>
              </select>
            </label>

            <label className="block text-xs font-medium text-content-subtle">
              Default chat mode
              <select
                value={chatMode}
                onChange={(e) => update({ chatMode: e.target.value as typeof chatMode })}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface-raised px-3 py-2 text-xs text-content focus:border-brand focus:outline-none"
              >
                <option value="concise">Concise</option>
                <option value="deep">Deep</option>
                <option value="interview">Interview</option>
              </select>
            </label>

            <label className="block text-xs font-medium text-content-subtle">
              Default note type
              <select
                value={defaultNoteType}
                onChange={(e) => update({ defaultNoteType: e.target.value as typeof defaultNoteType })}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface-raised px-3 py-2 text-xs text-content focus:border-brand focus:outline-none"
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
