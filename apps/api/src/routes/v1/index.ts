import { Router } from 'express';

import { workspacesRouter } from './workspaces.js';

export const v1Router = Router();

v1Router.use('/workspaces', workspacesRouter);
