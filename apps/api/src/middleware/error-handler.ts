import { AppError } from '../errors/app-error.js';

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

  const payload: ErrorPayload = {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred. Please try again later.'
  };

  const body: { error: ErrorPayload } = { error: payload };

  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }

  res.status(500).json(body);
};
