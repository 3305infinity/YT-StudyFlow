export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
    public code = 'RequestFailed'
  ) {
    super(message);
    this.name = 'AppError';
  }
}
