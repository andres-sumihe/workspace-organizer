import { Router } from 'express';

import {
  listWorkspaceProjectsHandler,
  createWorkspaceProjectHandler
} from '../../controllers/workspace-projects.controller.js';
import {
  listWorkspacesHandler,
  createWorkspaceHandler,
  getWorkspaceDetailHandler,
  updateWorkspaceHandler
} from '../../controllers/workspaces.controller.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const workspacesRouter = Router();

workspacesRouter.get('/', asyncHandler(listWorkspacesHandler));
workspacesRouter.post('/', asyncHandler(createWorkspaceHandler));
workspacesRouter.get('/:workspaceId', asyncHandler(getWorkspaceDetailHandler));
workspacesRouter.patch('/:workspaceId', asyncHandler(updateWorkspaceHandler));

workspacesRouter.get('/:workspaceId/projects', asyncHandler(listWorkspaceProjectsHandler));
workspacesRouter.post('/:workspaceId/projects', asyncHandler(createWorkspaceProjectHandler));
