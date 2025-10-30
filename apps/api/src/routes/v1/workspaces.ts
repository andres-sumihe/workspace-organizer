import { Router } from 'express';

import { listWorkspacesHandler, createWorkspaceHandler } from '../../controllers/workspaces.controller.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const workspacesRouter = Router();

workspacesRouter.get('/', asyncHandler(listWorkspacesHandler));
workspacesRouter.post('/', asyncHandler(createWorkspaceHandler));
