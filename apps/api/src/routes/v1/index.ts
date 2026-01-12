import { Router } from 'express';

import { auditRouter } from './audit.js';
import { authRouter } from './auth.js';
import { controlmJobsRouter } from './controlm-jobs.js';
import { installationRouter } from './installation.js';
import { schemaValidationRouter } from './schema-validation.js';
import { scriptsRouter } from './scripts.js';
import { settingsRouter } from './settings.js';
import { setupRouter } from './setup.js';
import { tagsRouter } from './tags.js';
import { teamConfigRouter } from './team-config.js';
import { teamControlmJobsRouter } from './team-controlm-jobs.js';
import { teamScriptsRouter } from './team-scripts.js';
import { teamsRouter } from './teams.js';
import { templatesRouter } from './templates.js';
import { toolsOvertimeRouter } from './tools-overtime.js';
import { workLogsRouter } from './work-logs.js';
import { workspacesRouter } from './workspaces.js';
import { isSharedDbConnected } from '../../db/shared-client.js';
import { installationService } from '../../services/installation.service.js';

import type { Request, Response, NextFunction } from 'express';

export const v1Router = Router();

// Setup routes - always available (no auth required) for first-time setup
v1Router.use('/setup', setupRouter);

// Installation routes - always available (no auth required)
v1Router.use('/installation', installationRouter);
v1Router.use('/team-config', teamConfigRouter);

// Auth routes - always available (supports both Solo and Shared modes)
v1Router.use('/auth', authRouter);

// Local database routes - always available (no auth required for now)
v1Router.use('/workspaces', workspacesRouter);
v1Router.use('/templates', templatesRouter);
v1Router.use('/settings', settingsRouter);

// Tools routes - always available (local data only, works in Solo and Shared modes)
v1Router.use('/tools/overtime', toolsOvertimeRouter);

// Work Journal routes - always available (local data only, works in Solo and Shared modes)
v1Router.use('/tags', tagsRouter);
v1Router.use('/work-logs', workLogsRouter);

// Middleware to check if shared database is connected for shared features
const requireSharedDb = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!isSharedDbConnected()) {
    const isConfigured = await installationService.isConfigured();
    if (!isConfigured) {
      res.status(503).json({
        code: 'NOT_CONFIGURED',
        message: 'Team features not configured. Please configure shared database in Settings.'
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
v1Router.use('/schema-validation', requireSharedDb, schemaValidationRouter);

// Team-scoped routes - require shared DB and team membership
v1Router.use('/teams', requireSharedDb, teamsRouter);
v1Router.use('/teams/:teamId/scripts', requireSharedDb, teamScriptsRouter);
v1Router.use('/teams/:teamId/controlm-jobs', requireSharedDb, teamControlmJobsRouter);

