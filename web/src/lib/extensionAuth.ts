export const EXT_ID_STORAGE_KEY = 'studyflow_ext_id';

/** Chrome extension IDs are 32 lowercase letters a–p. */
export const CHROME_EXTENSION_ID_RE = /^[a-p]{32}$/;

export function isValidExtensionId(value: string | null | undefined): value is string {
  const id = value?.trim() ?? '';
  return CHROME_EXTENSION_ID_RE.test(id);
}

export function persistExtensionId(extId: string): void {
  const trimmed = extId.trim();
  if (isValidExtensionId(trimmed)) {
    sessionStorage.setItem(EXT_ID_STORAGE_KEY, trimmed);
  }
}

export function readStoredExtensionId(): string | null {
  const stored = sessionStorage.getItem(EXT_ID_STORAGE_KEY);
  return isValidExtensionId(stored) ? stored.trim() : null;
}

/** Prefer a valid query param; fall back to sessionStorage after OAuth redirects. */
export function resolveExtensionId(fromQuery: string | null): string | null {
  const query = fromQuery?.trim() ?? '';
  if (isValidExtensionId(query)) {
    persistExtensionId(query);
    return query;
  }
  return readStoredExtensionId();
}

export function buildHostedExtensionCallbackUrl(origin: string, extId: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/auth/extension-callback?ext_id=${encodeURIComponent(extId.trim())}`;
}

export function buildChromeExtensionAuthCallbackUrl(
  extId: string,
  token: string
): string | null {
  if (!isValidExtensionId(extId)) return null;
  return `chrome-extension://${extId.trim()}/auth/callback.html#token=${encodeURIComponent(token)}`;
}
