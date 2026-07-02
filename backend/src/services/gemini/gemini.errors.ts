import { AppError } from '../../utils/appError.js';
import { logDev } from './gemini.config.js';

export type GeminiErrorKind =
  | 'invalid_api_key'
  | 'expired_api_key'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'model_unavailable'
  | 'invalid_request'
  | 'network'
  | 'timeout'
  | 'server_error'
  | 'empty_response'
  | 'missing_api_key'
  | 'unknown';

export type ParsedGeminiError = {
  kind: GeminiErrorKind;
  httpStatus: number;
  code: string;
  message: string;
  retryable: boolean;
  rawMessage?: string;
  rawStatus?: string;
};

type GeminiErrorBody = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: unknown;
  };
};

const API_KEY_PATTERNS = [
  /api key not valid/i,
  /invalid api key/i,
  /api_key_invalid/i,
  /permission denied/i,
  /api key expired/i,
  /expired api key/i,
];

const QUOTA_PATTERNS = [
  /quota exceeded/i,
  /resource exhausted/i,
  /exceeded your current quota/i,
  /billing/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

export function parseGeminiErrorBody(status: number, body: string): ParsedGeminiError {
  let apiMessage = '';
  let apiStatus = '';

  try {
    const parsed = JSON.parse(body) as GeminiErrorBody;
    apiMessage = parsed.error?.message?.trim() ?? '';
    apiStatus = parsed.error?.status?.trim() ?? '';
  } catch {
    apiMessage = body.trim().slice(0, 500);
  }

  const combined = `${apiMessage} ${apiStatus}`.trim();
  logDev('error-response', { httpStatus: status, apiStatus, apiMessage: apiMessage.slice(0, 300) });

  if (status === 404 || apiStatus === 'NOT_FOUND') {
    return {
      kind: 'model_unavailable',
      httpStatus: 404,
      code: 'ModelUnavailable',
      message: apiMessage || 'The requested Gemini model is unavailable.',
      retryable: false,
      rawMessage: apiMessage,
      rawStatus: apiStatus,
    };
  }

  if (status === 429 || apiStatus === 'RESOURCE_EXHAUSTED') {
    const isQuota =
      apiStatus === 'RESOURCE_EXHAUSTED' || matchesAny(combined, QUOTA_PATTERNS);
    return {
      kind: isQuota ? 'quota_exceeded' : 'rate_limited',
      httpStatus: 429,
      code: isQuota ? 'QuotaExceeded' : 'RateLimited',
      message: isQuota
        ? apiMessage || 'Quota exceeded. Please try again later.'
        : apiMessage || 'Rate limit reached. Wait a moment and retry.',
      retryable: false,
      rawMessage: apiMessage,
      rawStatus: apiStatus,
    };
  }

  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    apiStatus === 'INVALID_ARGUMENT' ||
    apiStatus === 'PERMISSION_DENIED' ||
    apiStatus === 'UNAUTHENTICATED'
  ) {
    if (matchesAny(combined, [/expired/i])) {
      return {
        kind: 'expired_api_key',
        httpStatus: 401,
        code: 'ExpiredApiKey',
        message: 'API key expired. Update GEMINI_API_KEY in backend/.env.',
        retryable: false,
        rawMessage: apiMessage,
        rawStatus: apiStatus,
      };
    }
    if (matchesAny(combined, API_KEY_PATTERNS)) {
      return {
        kind: 'invalid_api_key',
        httpStatus: 401,
        code: 'InvalidApiKey',
        message: 'Invalid API key. Check GEMINI_API_KEY in backend/.env.',
        retryable: false,
        rawMessage: apiMessage,
        rawStatus: apiStatus,
      };
    }
    return {
      kind: 'invalid_request',
      httpStatus: 400,
      code: 'InvalidRequest',
      message: apiMessage || 'Invalid request to Gemini API.',
      retryable: false,
      rawMessage: apiMessage,
      rawStatus: apiStatus,
    };
  }

  if (status >= 500) {
    return {
      kind: 'server_error',
      httpStatus: status,
      code: 'GeminiServerError',
      message: apiMessage || 'Gemini service temporarily unavailable.',
      retryable: true,
      rawMessage: apiMessage,
      rawStatus: apiStatus,
    };
  }

  return {
    kind: 'unknown',
    httpStatus: status >= 400 ? status : 502,
    code: 'GeminiError',
    message: apiMessage || 'AI request failed.',
    retryable: false,
    rawMessage: apiMessage,
    rawStatus: apiStatus,
  };
}

export function parseNetworkError(err: unknown): ParsedGeminiError {
  if (err instanceof Error && err.name === 'AbortError') {
    return {
      kind: 'timeout',
      httpStatus: 504,
      code: 'Timeout',
      message: 'Gemini request timed out. Try again with a shorter prompt.',
      retryable: true,
    };
  }

  const msg = err instanceof Error ? err.message : String(err);
  return {
    kind: 'network',
    httpStatus: 503,
    code: 'NetworkError',
    message: 'Network connection lost while contacting Gemini.',
    retryable: true,
  };
}

export function toAppError(parsed: ParsedGeminiError): AppError {
  return new AppError(parsed.httpStatus, parsed.message, parsed.rawMessage, parsed.code);
}

export function missingApiKeyError(): AppError {
  return new AppError(
    503,
    'AI service unavailable. Set GEMINI_API_KEY in backend/.env.',
    undefined,
    'MissingApiKey'
  );
}

export function emptyResponseError(): AppError {
  return new AppError(
    502,
    'Gemini returned an empty response. Try again.',
    undefined,
    'EmptyResponse'
  );
}

export function isRetryableGeminiError(err: unknown): boolean {
  if (err instanceof AppError) {
    return err.code === 'GeminiServerError' || err.code === 'NetworkError' || err.code === 'Timeout';
  }
  return false;
}
