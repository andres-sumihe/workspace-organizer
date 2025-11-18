import { Router } from 'express';

import { scriptsRouter } from './scripts.js';
import { workspacesRouter } from './workspaces.js';

export const v1Router = Router();

v1Router.use('/workspaces', workspacesRouter);
v1Router.use('/scripts', scriptsRouter);
