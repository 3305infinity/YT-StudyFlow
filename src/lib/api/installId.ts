/**
 * Per-install anonymous identity.
 *
 * A random UUID generated on first run and kept in chrome.storage.local. It is sent
 * as the `X-Install-Id` header so the backend can scope rate limits, quotas and
 * stored data per installation instead of lumping every user into one guest id.
 * It contains no personal data and is never tied to an account.
 */

export const INSTALL_ID_KEY = 'studyflow_install_id';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for contexts without randomUUID (crypto.getRandomValues is always available).
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

let cached: string | null = null;
let pending: Promise<string | null> | null = null;

async function resolveInstallId(): Promise<string | null> {
  if (typeof chrome === 'undefined' || !chrome?.storage?.local) return null;

  try {
    const stored = await chrome.storage.local.get(INSTALL_ID_KEY);
    const existing = String(stored[INSTALL_ID_KEY] ?? '').trim();
    if (UUID_RE.test(existing)) {
      cached = existing;
      return existing;
    }

    const fresh = generateUuid();
    await chrome.storage.local.set({ [INSTALL_ID_KEY]: fresh });
    cached = fresh;
    return fresh;
  } catch {
    return null;
  }
}

/** Returns the install id, creating and persisting one on first call. */
export async function getInstallId(): Promise<string | null> {
  if (cached) return cached;
  pending ??= resolveInstallId().finally(() => {
    pending = null;
  });
  return pending;
}
