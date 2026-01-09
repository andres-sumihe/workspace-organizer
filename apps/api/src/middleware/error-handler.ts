import { AppError } from '../errors/app-error.js';
import { apiLogger } from '../utils/logger.js';

import type { ErrorPayload } from '@workspace/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (_req, res) => {
  const payload: ErrorPayload = {
    code: 'ROUTE_NOT_FOUND',
    message: 'The requested resource could not be found.',
    details: []
  };

  const body: { error: ErrorPayload } = { error: payload };

  res.status(404).json(body);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Handle AppError instances (custom application errors)
  if (err instanceof AppError) {
    const payload: ErrorPayload = {
      code: err.code,
      message: err.message,
      details: err.details
    };

    const body: { error: ErrorPayload } = { error: payload };

    res.status(err.statusCode).json(body);
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    const payload: ErrorPayload = {
      code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      message: err.message
    };

    res.status(401).json({ error: payload });
    return;
  }

  // Handle specific authentication errors by message
  if (err.message === 'INVALID_CREDENTIALS' || err.message === 'USER_DISABLED') {
    const payload: ErrorPayload = {
      code: 'UNAUTHORIZED',
      message: err.message === 'USER_DISABLED' ? 'User account is disabled' : 'Invalid credentials'
    };

    res.status(401).json({ error: payload });
    return;
  }

  // Handle Zod validation errors (if thrown directly)
  if (err.name === 'ZodError') {
    const payload: ErrorPayload = {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.errors?.map((e: { path: string[]; message: string }) => ({
        field: e.path.join('.'),
        message: e.message
      }))
    };

    res.status(400).json({ error: payload });
    return;
  }

  // Default: Internal server error
  const payload: ErrorPayload = {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred. Please try again later.'
  };

  const body: { error: ErrorPayload } = { error: payload };

  // Always log unhandled errors
  apiLogger.error({ err, stack: err.stack }, 'Unhandled API error');

  res.status(500).json(body);
};
