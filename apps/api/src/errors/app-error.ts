import type { ErrorDetail } from '@workspace/shared';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: ErrorDetail[]
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: ErrorDetail[]) {
    super(message, 400, 'BAD_REQUEST', details);
    this.name = 'BadRequestError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, code = 'NOT_FOUND', details?: ErrorDetail[]) {
    super(message, 404, code, details);
    this.name = 'NotFoundError';
  }
}
