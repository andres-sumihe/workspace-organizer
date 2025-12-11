import { Router } from 'express';

import { auditRouter } from './audit.js';
import { authRouter } from './auth.js';
import controlmJobsRouter from './controlm-jobs.js';
import { installationRouter } from './installation.js';
import { scriptsRouter } from './scripts.js';
import settingsRouter from './settings.js';
import setupRouter from './setup.js';
import templatesRouter from './templates.js';
import { workspacesRouter } from './workspaces.js';
import { isSharedDbConnected } from '../../db/shared-client.js';
import { installationService } from '../../services/installation.service.js';

import type { Request, Response, NextFunction } from 'express';

export const v1Router = Router();

// Setup routes - always available (no auth required) for first-time setup
v1Router.use('/setup', setupRouter);

// Installation routes - always available (no auth required)
v1Router.use('/installation', installationRouter);

// Auth routes - always available (supports both Solo and Shared modes)
v1Router.use('/auth', authRouter);

// Local database routes - always available (no auth required for now)
v1Router.use('/workspaces', workspacesRouter);
v1Router.use('/templates', templatesRouter);
v1Router.use('/settings', settingsRouter);

// Middleware to check if shared database is connected for shared features
const requireSharedDb = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!isSharedDbConnected()) {
    const isConfigured = await installationService.isConfigured();
    if (!isConfigured) {
      res.status(503).json({
        code: 'NOT_CONFIGURED',
        message: 'Application not configured. Please complete the installation first.'
      });
      return;
    }
    res.status(503).json({
      code: 'SHARED_DB_UNAVAILABLE',
      message: 'Shared database is not connected. Please check the configuration.'
    });
    return;
  }
  next();
};

// Shared database routes - require shared DB to be connected
v1Router.use('/scripts', requireSharedDb, scriptsRouter);
v1Router.use('/controlm-jobs', requireSharedDb, controlmJobsRouter);
v1Router.use('/audit', requireSharedDb, auditRouter);

