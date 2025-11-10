import { AppError } from '../errors/app-error.js';
import {
  countWorkspaces,
  listWorkspaces,
  findWorkspaceById,
  updateWorkspace as updateWorkspaceRepo,
  incrementWorkspaceProjectCount,
} from '../repositories/workspaces.repository.js';
import { createWorkspace as createWorkspaceRepo } from '../repositories/workspaces.repository.js';

import type { CreateWorkspaceInput, UpdateWorkspaceInput } from '../repositories/workspaces.repository.js';
import type { WorkspaceDetail, WorkspaceListResponse } from '@workspace/shared';

interface WorkspaceListOptions {
  page: number;
  pageSize: number;
}

export const getWorkspaceList = async ({ page, pageSize }: WorkspaceListOptions): Promise<WorkspaceListResponse> => {
  const limit = pageSize;
  const offset = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    listWorkspaces({ limit, offset }),
    countWorkspaces()
  ]);

  const hasNextPage = page * pageSize < total;
  const hasPreviousPage = page > 1;

  return {
    items,
    meta: {
      total,
      page,
      pageSize,
      hasNextPage,
      hasPreviousPage
    }
  };
};

export const createWorkspace = async (input: CreateWorkspaceInput & { id: string; status?: string; createdAt: string; updatedAt: string; lastIndexedAt?: string; }) => {
  // Basic service layer passthrough - repository handles persistence and mapping.
  return createWorkspaceRepo(input);
};

export const getWorkspaceDetailById = async (workspaceId: string): Promise<WorkspaceDetail> => {
  const workspace = await findWorkspaceById(workspaceId);
  if (!workspace) {
    throw new AppError('Workspace not found.', 404, 'WORKSPACE_NOT_FOUND');
  }

  return workspace;
};

export const updateWorkspace = async (workspaceId: string, updates: UpdateWorkspaceInput): Promise<WorkspaceDetail> => {
  const updated = await updateWorkspaceRepo(workspaceId, updates);
  if (!updated) {
    throw new AppError('Workspace not found.', 404, 'WORKSPACE_NOT_FOUND');
  }

  return updated;
};

export const bumpWorkspaceProjectCount = async (workspaceId: string, delta: number) => {
  await incrementWorkspaceProjectCount(workspaceId, delta);
};
