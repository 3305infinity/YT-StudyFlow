const AUTH_TOKEN_KEY = 'studyflow_auth_token';

export type AuthUser = {
  userId: string;
  email?: string | null;
  name?: string | null;
  imageUrl?: string | null;
  usage?: {
    used: number;
    limit: number;
    remaining: number;
  };
};

export async function getAuthToken(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get(AUTH_TOKEN_KEY);
    const token = String(result[AUTH_TOKEN_KEY] ?? '').trim();
    return token || null;
  } catch {
    return null;
  }
}

export async function saveAuthToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [AUTH_TOKEN_KEY]: token.trim() });
}

export async function clearAuthSession(): Promise<void> {
  await chrome.storage.local.remove(AUTH_TOKEN_KEY);
}

/** Chrome extension IDs are 32 lowercase letters a–p. */
export const CHROME_EXTENSION_ID_RE = /^[a-p]{32}$/;

export function getExtensionId(): string {
  const extId = chrome.runtime?.id?.trim() ?? '';
  if (!CHROME_EXTENSION_ID_RE.test(extId)) {
    throw new Error('Extension id unavailable. Reload the extension and try again.');
  }
  return extId;
}

export function authWebBaseUrl(): string {
  const url =
    (import.meta.env.VITE_AUTH_WEB_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_CLERK_SIGN_IN_URL as string | undefined)?.trim() ||
    'http://localhost:5174';
  return url.replace(/\/$/, '');
}

export function buildSignInUrl(): string {
  const extId = getExtensionId();
  return `${authWebBaseUrl()}/sign-in?ext_id=${encodeURIComponent(extId)}&redirect=extension`;
}

/**
 * Opens hosted Clerk sign-in via the background service worker.
 * Content scripts cannot call chrome.windows.create (API unavailable in that context).
 * Sign-in URL is built in the service worker so chrome.runtime.id is always used there.
 */
export async function openHostedSignIn(): Promise<void> {
  const result = await chrome.runtime.sendMessage({
    type: 'YT_STUDYFLOW_OPEN_SIGN_IN',
    authWebUrl: authWebBaseUrl(),
  });
  if (!result?.ok) {
    throw new Error(
      typeof result?.error === 'string'
        ? result.error
        : 'Could not open the sign-in window. Allow popups for this extension.'
    );
  }
}

export async function isAuthenticated(): Promise<boolean> {
  return !!(await getAuthToken());
}

export function initAuthStorageListener(onChange: () => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[AUTH_TOKEN_KEY]) {
      onChange();
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'YT_STUDYFLOW_AUTH_COMPLETE') {
      onChange();
    }
  });
}
