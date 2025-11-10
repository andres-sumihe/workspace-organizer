import { apiRequest } from './client';

import type {
  WorkspaceListResponse,
  WorkspaceDetailResponse,
  WorkspaceProjectListResponse,
  WorkspaceProjectResponse
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
