import { getAuthToken } from './auth';
import { getInstallId } from './installId';
import { AUTH_DISABLED } from '@lib/config/auth.config';
import { apiBaseUrl } from '@lib/config/api.config';
import { friendlyAiError, logDevAiError } from '@lib/aiErrors';

export type ApiErrorBody = {
  error?: string;
  message?: string;
  details?: unknown;
};

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  static friendlyMessage(err: unknown): string {
    return friendlyAiError(err);
  }
}

type ProxyResponse = {
  ok: boolean;
  status: number;
  text: string;
  error?: string;
};

/**
 * Cold-start budget.
 *
 * The backend runs on Render's free tier, which suspends the service after ~15 minutes
 * of inactivity. The next request then has to wait for a full container boot, commonly
 * 30-60 seconds. These timeouts exist so that wait surfaces as "still loading" rather
 * than "cannot reach the server".
 */
const REQUEST_TIMEOUT_MS = 60_000;

/** Last-resort guard only: a dead service worker makes sendMessage reject immediately. */
const BACKGROUND_RESPONSE_TIMEOUT_MS = REQUEST_TIMEOUT_MS + 5_000;

/** Pause before the single automatic retry. */
const RETRY_DELAY_MS = 1_500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** True for failures that a cold start or a transient blip can explain. */
function isRetryableFailure(status: number): boolean {
  // 0 = network error / worker unreachable. 502/503/504 = Render still booting.
  return status === 0 || status === 502 || status === 503 || status === 504;
}

type WakeListener = (waking: boolean) => void;
const wakeListeners = new Set<WakeListener>();

/**
 * Notifies the UI that a request is waiting on a sleeping backend, so panels can show
 * a "waking up the server" message instead of an error. Returns an unsubscribe fn.
 */
export function onBackendWaking(listener: WakeListener): () => void {
  wakeListeners.add(listener);
  return () => wakeListeners.delete(listener);
}

function emitWaking(waking: boolean): void {
  for (const listener of wakeListeners) {
    try {
      listener(waking);
    } catch {
      // A broken listener must never break the request.
    }
  }
}

/** Message shown while the free-tier backend boots. */
export const BACKEND_WAKING_MESSAGE =
  'Waking up the StudyFlow server — this can take up to a minute on first use.';

async function fetchViaBackground(url: string, init: RequestInit): Promise<ProxyResponse> {
  const headers: Record<string, string> = {};
  if (init.headers instanceof Headers) {
    init.headers.forEach((value, key) => {
      headers[key] = value;
    });
  } else if (init.headers && typeof init.headers === 'object') {
    Object.assign(headers, init.headers);
  }

  // Anonymous per-install id so the backend can scope rate limits and data per user.
  const installId = await getInstallId();
  if (installId) {
    headers['X-Install-Id'] = installId;
  }

  const doDirectFetch = async (): Promise<ProxyResponse> => {
    try {
      const res = await fetch(url, { ...init, headers });
      const text = await res.text();
      return { ok: res.ok, status: res.status, text };
    } catch (e) {
      return { ok: false, status: 0, text: '', error: e instanceof Error ? e.message : String(e) };
    }
  };

  if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
    return doDirectFetch();
  }

  try {
    const messagePromise = chrome.runtime.sendMessage({
      type: 'YT_STUDYFLOW_API_REQUEST',
      url,
      method: init.method ?? 'GET',
      headers,
      body: typeof init.body === 'string' ? init.body : undefined,
    });

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), BACKGROUND_RESPONSE_TIMEOUT_MS)
    );
    const result = await Promise.race([messagePromise, timeoutPromise]);

    if (!result || typeof (result as ProxyResponse).status !== 'number') {
      return doDirectFetch();
    }

    return result as ProxyResponse;
  } catch {
    return doDirectFetch();
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set('Content-Type', 'application/json');

  if (auth) {
    // TODO: Re-enable token requirement when AUTH_DISABLED is false.
    if (!AUTH_DISABLED) {
      const token = await getAuthToken();
      if (!token) {
        throw new ApiClientError(401, 'Sign in required to use AI features.');
      }
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const url = `${apiBaseUrl()}${path}`;

  /** One attempt, with its own abort timer. */
  const attempt = async (): Promise<ProxyResponse> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetchViaBackground(url, { ...rest, headers, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    let proxied = await attempt();

    // A sleeping Render instance refuses or stalls the first request. Retry once
    // before surfacing an error, and tell the UI why it is taking so long.
    if (!proxied.ok && isRetryableFailure(proxied.status)) {
      logDevAiError(`api ${path} retrying`, proxied.error ?? `status ${proxied.status}`);
      emitWaking(true);
      try {
        await sleep(RETRY_DELAY_MS);
        proxied = await attempt();
      } finally {
        emitWaking(false);
      }
    }

    if (!proxied.ok) {
      let body: ApiErrorBody = {};
      if (proxied.text) {
        try {
          body = JSON.parse(proxied.text) as ApiErrorBody;
        } catch {
          body = { message: proxied.text };
        }
      }
      const apiErr = new ApiClientError(
        proxied.status,
        body.message ?? proxied.error ?? `Request failed (${proxied.status})`,
        body.error
      );
      logDevAiError(`api ${path}`, apiErr);
      throw apiErr;
    }

    if (!proxied.text) return {} as T;

    return JSON.parse(proxied.text) as T;
  } catch (e) {
    if (e instanceof ApiClientError) throw e;
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ApiClientError(504, 'Request timed out. Try again.', 'Timeout');
    }
    logDevAiError(`api ${path} unexpected`, e);
    throw e;
  }
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => apiRequest<void>(path, { method: 'DELETE' }),
};

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const result = await fetchViaBackground(`${apiBaseUrl()}/health`, { method: 'GET' });
    return result.ok;
  } catch {
    return false;
  }
}
