import { Router } from 'express';

import { getDb } from '../db/client.js';
import { asyncHandler } from '../utils/async-handler.js';

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const startedAt = Date.now();
    let databaseStatus: 'connected' | 'error' = 'connected';

    try {
      const db = await getDb();
      await db.get('SELECT 1');
    } catch (error) {
      console.error('Health check database error:', error);
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

    if (databaseStatus === 'error') {
      res.status(503);
    }

    res.json(payload);
  })
);
