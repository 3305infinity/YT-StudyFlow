export type ErrorCategory = 'transient' | 'permanent' | 'unknown';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly category: ErrorCategory = 'unknown',
    public readonly cause?: Error,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  isTransient(): boolean {
    return this.category === 'transient';
  }
}

export function isTransientError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isTransient();
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('enotfound') ||
      message.includes('etimedout')
    );
  }
  return false;
}

export function createTimeoutError(service: string, timeoutMs: number): AppError {
  return new AppError(
    504,
    `${service} timeout after ${timeoutMs}ms`,
    'transient',
    undefined,
    { service, timeoutMs }
  );
}