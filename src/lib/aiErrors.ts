import { ApiClientError } from '@lib/api/client';

/** Known error codes from the StudyFlow backend and Gemini integration. */
export type AiErrorCode =
  | 'TooManyRequests'
  | 'DailyQuotaExceeded'
  | 'QuotaExceeded'
  | 'RateLimited'
  | 'InvalidApiKey'
  | 'ExpiredApiKey'
  | 'MissingApiKey'
  | 'ModelUnavailable'
  | 'InvalidRequest'
  | 'GeminiServerError'
  | 'NetworkError'
  | 'Timeout'
  | 'EmptyResponse'
  | 'Unauthorized'
  | string;

const DEV = import.meta.env.DEV;

export function logDevAiError(context: string, err: unknown): void {
  if (!DEV) return;
  if (err instanceof ApiClientError) {
    console.debug(`[ai:dev] ${context}`, {
      status: err.status,
      code: err.code,
      message: err.message,
    });
    return;
  }
  console.debug(`[ai:dev] ${context}`, err);
}

/** Map backend/Gemini errors to actionable UI messages. */
export function friendlyAiError(err: unknown): string {
  logDevAiError('friendlyAiError', err);

  if (err instanceof ApiClientError) {
    switch (err.code) {
      case 'TooManyRequests':
        return 'Too many requests. Wait a moment and retry.';
      case 'DailyQuotaExceeded':
        return 'Daily AI quota reached. Try again tomorrow.';
      case 'QuotaExceeded':
        return 'Quota exceeded. Please try again later.';
      case 'RateLimited':
        return 'Rate limit reached. Wait a moment and retry.';
      case 'InvalidApiKey':
        return 'Invalid API key. Check GEMINI_API_KEY in backend/.env.';
      case 'ExpiredApiKey':
        return 'API key expired. Update GEMINI_API_KEY in backend/.env.';
      case 'MissingApiKey':
        return 'AI service unavailable. Set GEMINI_API_KEY in backend/.env.';
      case 'ModelUnavailable':
        return 'Gemini model unavailable. Check model configuration.';
      case 'InvalidRequest':
        return err.message || 'Invalid AI request.';
      case 'GeminiServerError':
        return 'Gemini service temporarily unavailable.';
      case 'NetworkError':
        return 'Network connection lost.';
      case 'Timeout':
        return 'Request timed out. Try a shorter question.';
      case 'EmptyResponse':
        return 'Gemini returned an empty response. Try again.';
      case 'Unauthorized':
        return 'Session expired. Sign in again in Profile.';
      default:
        break;
    }

    if (err.status === 401) return 'Session expired. Sign in again in Profile.';
    if (err.status === 504) return 'Request timed out. Try again.';
    if (err.status === 0) {
      return err.message.includes('background')
        ? 'Extension background worker unavailable. Reload the extension.'
        : 'Cannot reach StudyFlow servers. Check your connection.';
    }
    if (err.status >= 500) return err.message || 'Service temporarily unavailable. Try again in a moment.';
    return err.message || 'Something went wrong. Please try again.';
  }

  if (err instanceof Error) {
    if (err.message.includes('Failed to fetch')) {
      return 'Cannot reach StudyFlow servers. Check your connection.';
    }
    return err.message;
  }

  return 'Something went wrong. Please try again.';
}

/** True only for Gemini quota/rate-limit errors — used for optional transcript fallback. */
export function isGeminiQuotaError(err: unknown): boolean {
  if (err instanceof ApiClientError) {
    return err.code === 'QuotaExceeded' || err.code === 'RateLimited';
  }
  return false;
}

/** True when AI is unavailable due to auth/key issues — do not retry automatically. */
export function isAiConfigError(err: unknown): boolean {
  if (!(err instanceof ApiClientError)) return false;
  return (
    err.code === 'InvalidApiKey' ||
    err.code === 'ExpiredApiKey' ||
    err.code === 'MissingApiKey' ||
    err.code === 'InvalidRequest' ||
    err.code === 'Unauthorized'
  );
}
