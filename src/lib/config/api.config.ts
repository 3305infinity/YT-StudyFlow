/**
 * Single source of truth for the backend base URL.
 * Shared by the API client and the background service worker so the worker can
 * verify that a proxied request actually targets our backend.
 */

export const DEFAULT_API_BASE_URL = 'https://yt-studyflow.onrender.com';

export function apiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (envUrl && envUrl !== 'http://localhost:3001' && envUrl !== 'http://127.0.0.1:3001') {
    return envUrl;
  }
  if (import.meta.env.PROD) {
    return DEFAULT_API_BASE_URL;
  }
  return envUrl || DEFAULT_API_BASE_URL;
}

/** Origin of {@link apiBaseUrl}, or null when the configured value is not a valid URL. */
export function apiOrigin(): string | null {
  try {
    return new URL(apiBaseUrl()).origin;
  } catch {
    return null;
  }
}
