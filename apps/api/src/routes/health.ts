import { Router } from 'express';

import { getDb } from '../db/client.js';
import { asyncHandler } from '../utils/async-handler.js';

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    console.log('[Health] Health check starting');
    const startedAt = Date.now();
    let databaseStatus: 'connected' | 'error' = 'connected';

    try {
      console.log('[Health] Getting database connection');
      const db = await getDb();
      console.log('[Health] Running SELECT 1 query');
      db.prepare('SELECT 1').get();
      console.log('[Health] Database check passed');
    } catch (error) {
      console.error('[Health] Database error:', error);
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

    console.log('[Health] Sending response:', payload.status);

    if (databaseStatus === 'error') {
      res.status(503);
    }

    res.json(payload);
  })
);
