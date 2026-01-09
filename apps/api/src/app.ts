import cors from 'cors';
import express from 'express';

import { getDb } from './db/client.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';
import { installationService } from './services/installation.service.js';
import { sessionService } from './services/session.service.js';
import { dbLogger, sessionLogger, requestLogger } from './utils/logger.js';

import type { Express } from 'express';

// CORS configuration for desktop app
// In Electron production, requests come from app:// protocol or file://
// In development, requests come from localhost:5173
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (Electron, mobile apps, curl, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Allow localhost for development
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      callback(null, true);
      return;
    }

    // Allow app:// protocol for Electron
    if (origin.startsWith('app://')) {
      callback(null, true);
      return;
    }

    // Allow file:// for Electron development
    if (origin.startsWith('file://')) {
      callback(null, true);
      return;
    }

    // Reject other origins
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

export const createApp = async (): Promise<Express> => {
  const app = express();

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '10mb' }));
  app.use(requestLogger);

  // Initialize local database connection first - this MUST succeed
  dbLogger.info('Initializing local database');
  try {
    const db = await getDb();
    dbLogger.info('Local database initialized successfully');
    // Quick test query
    db.prepare('SELECT 1').get();
    dbLogger.debug('Database connection verified');
  } catch (error) {
    dbLogger.error({ err: error }, 'CRITICAL: Failed to initialize local database');
    throw error; // Don't continue if database fails
  }

  // Clean up expired sessions on startup and start periodic cleanup
  try {
    await sessionService.cleanupExpiredSessions();
    sessionService.startPeriodicCleanup();
  } catch (error) {
    sessionLogger.error({ err: error }, 'Failed to cleanup sessions');
  }

  // Initialize shared database if configured (runs pending migrations)
  try {
    await installationService.initializeOnStartup();
  } catch (error) {
    dbLogger.error({ err: error }, 'Failed to initialize shared database');
  }

  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
