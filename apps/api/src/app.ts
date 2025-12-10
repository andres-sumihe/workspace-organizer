import cors from 'cors';
import express from 'express';
import morgan from 'morgan';

import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';
import { installationService } from './services/installation.service.js';

import type { Express } from 'express';

export const createApp = async (): Promise<Express> => {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(morgan('dev'));

  // Initialize shared database if configured
  try {
    const initialized = await installationService.initializeOnStartup();
    if (initialized) {
      console.log('Shared database connection initialized');
    } else {
      console.log('Shared database not configured - installation required');
    }
  } catch (error) {
    console.error('Failed to initialize shared database:', error);
  }

  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
