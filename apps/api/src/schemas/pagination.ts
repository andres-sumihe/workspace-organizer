import { BadRequestError } from '../errors/app-error.js';

import type { ErrorDetail } from '@workspace/shared';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface PaginationParams {
  page: number;
  pageSize: number;
}

const coerceInteger = (value: unknown): number | null => {
  if (Array.isArray(value)) {
    return coerceInteger(value[0]);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
};

export const parsePaginationQuery = (query: unknown): PaginationParams => {
  const source = query && typeof query === 'object' ? (query as Record<string, unknown>) : {};
  const details: ErrorDetail[] = [];

  const pageValue = coerceInteger(source.page);
  const pageSizeValue = coerceInteger(source.pageSize);

  let page = pageValue ?? DEFAULT_PAGE;
  let pageSize = pageSizeValue ?? DEFAULT_PAGE_SIZE;

  if (page < 1) {
    details.push({
      field: 'page',
      code: 'invalid',
      message: 'page must be greater than or equal to 1'
    });
  }

  if (pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    details.push({
      field: 'pageSize',
      code: 'invalid',
      message: `pageSize must be between 1 and ${MAX_PAGE_SIZE}`
    });
  }

  if (details.length > 0) {
    throw new BadRequestError('Invalid pagination parameters.', details);
  }

  page = Math.max(page, 1);
  pageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);

  return {
    page,
    pageSize
  };
};
