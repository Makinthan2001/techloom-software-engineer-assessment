import type { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors.js';

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log full details server-side ONLY (never leak stack traces or internals to client)
  console.error('🔥 Server Error Handler Caught:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });

  // 1. Handle known custom AppErrors
  if (err instanceof AppError) {
    const responseBody: { success: false; message: string; errors?: unknown } = {
      success: false,
      message: err.message,
    };

    if (err instanceof ValidationError && err.details !== undefined) {
      responseBody.errors = err.details;
    }

    return res.status(err.statusCode).json(responseBody);
  }

  // 2. Handle Prisma Known Request Errors safely (without leaking SQL/schema/connection strings)
  if (err.name === 'PrismaClientKnownRequestError') {
    return res.status(409).json({
      success: false,
      message: 'A database constraint conflict occurred.',
    });
  }

  // 3. Generic 500 internal server error fallback (safe envelope)
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};
