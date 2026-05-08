import { BadRequestError } from '../errors/app-error.js';
import { searchService } from '../services/search.service.js';

import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import type { NextFunction, Response } from 'express';

const DEFAULT_LIMIT_PER_DOMAIN = 5;

const parseLimit = (value: unknown): number => {
  if (typeof value !== 'string') {
    return DEFAULT_LIMIT_PER_DOMAIN;
  }

  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_LIMIT_PER_DOMAIN;
};

export const searchController = {
  async search(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const rawQuery = typeof req.query.q === 'string' ? req.query.q : '';
      const query = rawQuery.trim();

      if (query.length > 100) {
        throw new BadRequestError('Search query must be 100 characters or fewer', [
          { field: 'q', code: 'MAX_LENGTH', message: 'Search query must be 100 characters or fewer' },
        ]);
      }

      const result = await searchService.search(query, req.user, parseLimit(req.query.limit));

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },
};