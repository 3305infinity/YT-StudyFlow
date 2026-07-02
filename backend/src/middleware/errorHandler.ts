import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  console.error('[backend]', err);
  res.status(500).json({
    error: 'InternalServerError',
    message: 'Something went wrong. Please try again.',
  });
}
