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

export async function isAuthenticated(): Promise<boolean> {
  return !!(await getAuthToken());
}

export function initAuthStorageListener(onChange: () => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[AUTH_TOKEN_KEY]) {
      onChange();
    }
  });
}
