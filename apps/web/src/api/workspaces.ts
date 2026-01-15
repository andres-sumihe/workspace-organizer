import { apiRequest } from './client';

import type {
  WorkspaceListResponse,
  WorkspaceDetailResponse,
  WorkspaceProjectListResponse,
  WorkspaceProjectResponse,
  WorkspaceSummary
} from '@workspace/shared';

export const fetchWorkspaceList = (page = 1, pageSize = 6, signal?: AbortSignal) => {
  return apiRequest<WorkspaceListResponse>('/api/v1/workspaces', {
    query: {
      page,
      pageSize,
    },
    signal,
  });
};

export const createWorkspace = (payload: { name: string; rootPath: string; description?: string }) => {
  return apiRequest<{ workspace: unknown }>('/api/v1/workspaces', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

export const fetchWorkspaceDetail = (workspaceId: string) => {
  return apiRequest<WorkspaceDetailResponse>(`/api/v1/workspaces/${workspaceId}`);
};

export const updateWorkspace = (
  workspaceId: string,
  payload: { name?: string; rootPath?: string; description?: string }
) => {
  return apiRequest<{ workspace: unknown }>(`/api/v1/workspaces/${workspaceId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
};

export const fetchWorkspaceProjects = (workspaceId: string) => {
  return apiRequest<WorkspaceProjectListResponse>(`/api/v1/workspaces/${workspaceId}/projects`);
};

export const createWorkspaceProject = (
  workspaceId: string,
  payload: { name: string; relativePath: string; description?: string }
) => {
  return apiRequest<WorkspaceProjectResponse>(`/api/v1/workspaces/${workspaceId}/projects`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

export const updateWorkspaceProject = (
  workspaceId: string,
  projectId: string,
  payload: { name?: string; relativePath?: string; description?: string }
) => {
  return apiRequest<WorkspaceProjectResponse>(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
};

export const deleteWorkspaceProject = (workspaceId: string, projectId: string) => {
  return apiRequest<{ success: boolean }>(`/api/v1/workspaces/${workspaceId}/projects/${projectId}`, {
    method: 'DELETE'
  });
};

// ============================================================================
// Workspaces API (convenience object)
// ============================================================================

export interface WorkspacesListParams {
  page?: number;
  pageSize?: number;
}

export const workspacesApi = {
  /**
   * List workspaces with pagination
   */
  async list(params: WorkspacesListParams = {}): Promise<{ items: WorkspaceSummary[]; total: number }> {
    const { page = 1, pageSize = 100 } = params;
    const response = await fetchWorkspaceList(page, pageSize);
    return {
      items: response.items,
      total: response.meta.total
    };
  },

  /**
   * Get workspace detail by ID
   */
  getById: (id: string) => fetchWorkspaceDetail(id)
};
