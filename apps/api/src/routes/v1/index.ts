import { Router } from 'express';

import { scriptsRouter } from './scripts.js';
import settingsRouter from './settings.js';
import templatesRouter from './templates.js';
import { workspacesRouter } from './workspaces.js';

export const v1Router = Router();

v1Router.use('/workspaces', workspacesRouter);
v1Router.use('/scripts', scriptsRouter);
v1Router.use('/templates', templatesRouter);
v1Router.use('/settings', settingsRouter);
