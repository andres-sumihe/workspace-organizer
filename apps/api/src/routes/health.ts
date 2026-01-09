import { Router } from 'express';

import { getDb } from '../db/client.js';
import { asyncHandler } from '../utils/async-handler.js';
import { apiLogger } from '../utils/logger.js';

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    apiLogger.debug('Health check starting');
    const startedAt = Date.now();
    let databaseStatus: 'connected' | 'error' = 'connected';

    try {
      apiLogger.debug('Getting database connection');
      const db = await getDb();
      apiLogger.debug('Running SELECT 1 query');
      db.prepare('SELECT 1').get();
      apiLogger.debug('Database check passed');
    } catch (error) {
      apiLogger.error({ err: error }, 'Health check database error');
      databaseStatus = 'error';
    }

    const payload = {
      status: databaseStatus === 'connected' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - startedAt,
      dependencies: {
        database: databaseStatus
      }
    };

    apiLogger.debug({ status: payload.status }, 'Health check response');

    if (databaseStatus === 'error') {
      res.status(503);
    }

    res.json(payload);
  })
);
