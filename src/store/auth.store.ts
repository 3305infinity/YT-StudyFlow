import { create } from 'zustand';
import {
  clearAuthSession,
  initAuthStorageListener,
  isAuthenticated,
  openHostedSignIn,
  type AuthUser,
} from '@lib/api/auth';
import { api, ApiClientError, checkBackendHealth } from '@lib/api/client';
import { initSyncOnlineListener, runSync } from '@lib/sync/engine';
import { AUTH_DISABLED, GUEST_USER_ID } from '@lib/config/auth.config';
import { CLOUD_SYNC_DISABLED } from '@lib/config/sync.config';

const GUEST_USER: AuthUser = {
  userId: GUEST_USER_ID,
  name: 'Guest',
  email: 'guest@local.dev',
  usage: { used: 0, limit: 9999, remaining: 9999 },
};

const SIGN_IN_TIMEOUT_MS = 120_000;
let signInTimeoutId: ReturnType<typeof setTimeout> | null = null;

function clearSignInTimeout(): void {
  if (signInTimeoutId) {
    clearTimeout(signInTimeoutId);
    signInTimeoutId = null;
  }
}

function scheduleSignInTimeout(reset: () => void): void {
  clearSignInTimeout();
  signInTimeoutId = setTimeout(() => {
    void (async () => {
      if (await isAuthenticated()) {
        await reset();
        return;
      }
      useAuthStore.setState({
        signingIn: false,
        signInError: 'Sign-in timed out or was cancelled. Try again.',
      });
    })();
  }, SIGN_IN_TIMEOUT_MS);
}

interface AuthState {
  user: AuthUser | null;
  loaded: boolean;
  backendOnline: boolean;
  signingIn: boolean;
  signInError: string | null;
  load: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signIn: () => void;
  signOut: () => Promise<void>;
  clearSignInError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loaded: false,
  backendOnline: false,
  signingIn: false,
  signInError: null,

  load: async () => {
    const online = await checkBackendHealth();

    // TODO: Remove guest bypass when re-enabling authentication.
    if (AUTH_DISABLED) {
      set({
        user: GUEST_USER,
        backendOnline: online,
        loaded: true,
        signingIn: false,
        signInError: null,
      });
      // TODO: Re-enable runSync() when CLOUD_SYNC_DISABLED=false.
      if (!CLOUD_SYNC_DISABLED) void runSync();
      return;
    }

    const authed = await isAuthenticated();

    if (!authed) {
      set({ user: null, backendOnline: online, loaded: true, signingIn: false, signInError: null });
      return;
    }

    try {
      const profile = await api.get<AuthUser>('/api/auth/me');
      clearSignInTimeout();
      set({ user: profile, backendOnline: online, loaded: true, signingIn: false, signInError: null });
      if (!CLOUD_SYNC_DISABLED) void runSync();
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) {
        await clearAuthSession();
        set({ user: null, backendOnline: online, loaded: true, signingIn: false, signInError: null });
        return;
      }
      set({
        user: {
          userId: 'pending',
          name: 'Signed in',
          email: null,
        },
        backendOnline: online,
        loaded: true,
        signingIn: false,
        signInError: online
          ? null
          : 'Signed in locally. Cloud sync resumes when the server is available.',
      });
    }
  },

  refreshProfile: async () => {
    if (!(await isAuthenticated())) {
      set({ user: null, signingIn: false });
      return;
    }
    try {
      const profile = await api.get<AuthUser>('/api/auth/me');
      clearSignInTimeout();
      set({ user: profile, signingIn: false, signInError: null, backendOnline: true });
      if (!CLOUD_SYNC_DISABLED) void runSync();
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) {
        await clearAuthSession();
        set({ user: null, signingIn: false, signInError: 'Session expired. Please sign in again.' });
        return;
      }
      set({ signingIn: false });
    }
  },

  signIn: () => {
    // TODO: Re-enable Clerk sign-in when AUTH_DISABLED is false.
    if (AUTH_DISABLED) {
      set({ user: GUEST_USER, signingIn: false, signInError: null });
      return;
    }

    set({ signingIn: true, signInError: null });

    void openHostedSignIn().catch((err) => {
      set({
        signingIn: false,
        signInError: err instanceof Error ? err.message : 'Could not open sign-in.',
      });
    });

    scheduleSignInTimeout(() => get().refreshProfile());
  },

  signOut: async () => {
    // TODO: Re-enable sign-out when AUTH_DISABLED is false.
    if (AUTH_DISABLED) {
      set({ user: GUEST_USER, signingIn: false, signInError: null });
      return;
    }

    clearSignInTimeout();
    await clearAuthSession();
    set({ user: null, signingIn: false, signInError: null });
  },

  clearSignInError: () => set({ signInError: null }),
}));

initAuthStorageListener(() => {
  void useAuthStore.getState().refreshProfile();
});

initSyncOnlineListener();

export async function canUseBackendAi(): Promise<boolean> {
  if (AUTH_DISABLED) return true;
  return isAuthenticated();
}
