import { create } from 'zustand';
import {
  clearAuthSession,
  getAuthToken,
  saveAuthToken,
  type AuthUser,
} from '@lib/api/auth';
import { api, ApiClientError, checkBackendHealth } from '@lib/api/client';
import { runSync } from '@lib/sync/engine';
import { AUTH_DISABLED, GUEST_USER_ID } from '@lib/config/auth.config';
import { CLOUD_SYNC_DISABLED } from '@lib/config/sync.config';

interface AuthState {
  user: AuthUser | null;
  loaded: boolean;
  backendOnline: boolean;
  authenticating: boolean;
  authError: string | null;
  load: () => Promise<void>;
  login: (params: { email: string; password: string }) => Promise<void>;
  signup: (params: { name?: string; email: string; password: string; confirmPassword?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: AUTH_DISABLED ? { userId: GUEST_USER_ID, name: 'Local Guest', email: 'guest@studyflow.local' } : null,
  loaded: AUTH_DISABLED ? true : false,
  backendOnline: true,
  authenticating: false,
  authError: null,

  load: async () => {
    if (AUTH_DISABLED) {
      set({
        user: { userId: GUEST_USER_ID, name: 'Local Guest', email: 'guest@studyflow.local' },
        backendOnline: true,
        loaded: true,
        authenticating: false,
        authError: null,
      });
      return;
    }

    try {
      const healthPromise = checkBackendHealth();
      const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2000));
      const online = await Promise.race([healthPromise, timeoutPromise]);
      const token = await getAuthToken();

      if (!token) {
        set({ user: null, backendOnline: online, loaded: true, authenticating: false, authError: null });
        return;
      }

      const resp = await api.get<{ user: AuthUser }>('/api/auth/me');
      set({ user: resp.user, backendOnline: online, loaded: true, authenticating: false, authError: null });
      if (!CLOUD_SYNC_DISABLED) void runSync();
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) {
        await clearAuthSession();
      }
      set({ user: null, backendOnline: false, loaded: true, authenticating: false });
    } finally {
      set({ loaded: true });
    }
  },

  login: async ({ email, password }) => {
    set({ authenticating: true, authError: null });
    try {
      const resp = await api.post<{ token: string; user: AuthUser }>('/api/auth/login', { email, password });
      await saveAuthToken(resp.token);
      set({ user: resp.user, authenticating: false, authError: null });
      if (!CLOUD_SYNC_DISABLED) void runSync();
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : 'Invalid email or password.';
      set({ authenticating: false, authError: msg });
      throw new Error(msg);
    }
  },

  signup: async ({ name, email, password, confirmPassword }) => {
    set({ authenticating: true, authError: null });
    try {
      const resp = await api.post<{ token: string; user: AuthUser }>('/api/auth/signup', {
        name,
        email,
        password,
        confirmPassword,
      });
      await saveAuthToken(resp.token);
      set({ user: resp.user, authenticating: false, authError: null });
      if (!CLOUD_SYNC_DISABLED) void runSync();
    } catch (err: unknown) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to create account.';
      set({ authenticating: false, authError: msg });
      throw new Error(msg);
    }
  },

  signOut: async () => {
    await clearAuthSession();
    set({ user: null, authenticating: false, authError: null });
  },

  clearAuthError: () => set({ authError: null }),
}));
