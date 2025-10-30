import { countWorkspaces, listWorkspaces } from '../repositories/workspaces.repository.js';
import { createWorkspace as createWorkspaceRepo } from '../repositories/workspaces.repository.js';

import type { CreateWorkspaceInput } from '../repositories/workspaces.repository.js';
import type { WorkspaceListResponse } from '@workspace/shared';

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
