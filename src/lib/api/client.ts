import { getAuthToken } from './auth';
import { AUTH_DISABLED } from '@lib/config/auth.config';
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

function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || 'http://localhost:3001';
}

type ProxyResponse = {
  ok: boolean;
  status: number;
  text: string;
  error?: string;
};

async function fetchViaBackground(url: string, init: RequestInit): Promise<ProxyResponse> {
  const headers: Record<string, string> = {};
  if (init.headers instanceof Headers) {
    init.headers.forEach((value, key) => {
      headers[key] = value;
    });
  } else if (init.headers && typeof init.headers === 'object') {
    Object.assign(headers, init.headers);
  }

  const result = await chrome.runtime.sendMessage({
    type: 'YT_STUDYFLOW_API_REQUEST',
    url,
    method: init.method ?? 'GET',
    headers,
    body: typeof init.body === 'string' ? init.body : undefined,
  });

  if (!result || typeof result.status !== 'number') {
    throw new ApiClientError(0, 'Extension background worker unavailable.');
  }

  return result as ProxyResponse;
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);

  try {
    const proxied = await fetchViaBackground(url, {
      ...rest,
      headers,
      signal: controller.signal,
    });

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
  } finally {
    clearTimeout(timeout);
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
