import { AppError } from '../errors/app-error.js';
import { findWorkspaceById } from '../repositories/workspaces.repository.js';
import {
  createProject,
  listProjectsByWorkspace,
  findProjectByWorkspaceAndPath
} from '../repositories/projects.repository.js';
import { bumpWorkspaceProjectCount } from './workspaces.service.js';

import { v4 as uuidv4 } from 'uuid';

import type { WorkspaceProject } from '@workspace/shared';

const sanitizeRelativePath = (value: string) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError('Project path is required.', 400, 'INVALID_PROJECT_PATH');
  }
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (normalized === '' || normalized === '.') {
    throw new AppError('Project path must reference a folder inside the workspace.', 400, 'INVALID_PROJECT_PATH');
  }
  if (normalized.includes('..')) {
    throw new AppError('Project path cannot traverse outside the workspace.', 400, 'INVALID_PROJECT_PATH');
  }
  return normalized;
};

export const listWorkspaceProjects = async (workspaceId: string): Promise<WorkspaceProject[]> => {
  return listProjectsByWorkspace(workspaceId);
};

export const createWorkspaceProject = async (workspaceId: string, payload: { name?: string; relativePath?: string; description?: string; }): Promise<WorkspaceProject> => {
  if (!payload.name || payload.name.trim() === '') {
    throw new AppError('Project name is required.', 400, 'INVALID_PROJECT_NAME');
  }

  const workspace = await findWorkspaceById(workspaceId);
  if (!workspace) {
    throw new AppError('Workspace not found.', 404, 'WORKSPACE_NOT_FOUND');
  }

  const relativePath = sanitizeRelativePath(payload.relativePath ?? '');

  const existing = await findProjectByWorkspaceAndPath(workspaceId, relativePath);
  if (existing) {
    throw new AppError('A project already tracks this folder.', 409, 'PROJECT_PATH_CONFLICT');
  }

  const now = new Date().toISOString();
  const project = await createProject({
    id: uuidv4(),
    workspaceId,
    name: payload.name.trim(),
    relativePath,
    description: payload.description?.trim() || undefined,
    createdAt: now,
    updatedAt: now
  });

  await bumpWorkspaceProjectCount(workspaceId, 1);

  return project;
};
