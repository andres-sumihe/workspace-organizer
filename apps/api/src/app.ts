import cors from 'cors';
import express from 'express';
import morgan from 'morgan';

import { getDb } from './db/client.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';
import { installationService } from './services/installation.service.js';
import { sessionService } from './services/session.service.js';

import type { Express } from 'express';

export const createApp = async (): Promise<Express> => {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(morgan('dev'));

  // Initialize local database connection first - this MUST succeed
  console.log('[App] Initializing local database...');
  try {
    const db = await getDb();
    console.log('[App] Local database initialized successfully');
    // Quick test query
    db.prepare('SELECT 1').get();
    console.log('[App] Database connection verified');
  } catch (error) {
    console.error('[App] CRITICAL: Failed to initialize local database:', error);
    throw error; // Don't continue if database fails
  }

  // Clean up expired sessions on startup and start periodic cleanup
  try {
    await sessionService.cleanupExpiredSessions();
    sessionService.startPeriodicCleanup();
  } catch (error) {
    console.error('Failed to cleanup sessions:', error);
  }

  // Initialize shared database if configured (runs pending migrations)
  try {
    await installationService.initializeOnStartup();
  } catch (error) {
    console.error('Failed to initialize shared database:', error);
  }

  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
