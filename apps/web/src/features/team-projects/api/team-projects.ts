/**
 * Team Projects API client
 * Handles all team-project-related HTTP requests
 */

import { apiClient } from '@/api/client';

import type {
  TeamProjectListResponse,
  TeamProjectResponse,
  CreateTeamProjectRequest,
  UpdateTeamProjectRequest,
  TeamProjectStatus,
} from '@workspace/shared';

export const fetchTeamProjects = (
  teamId: string,
  page = 1,
  pageSize = 20,
  filters?: {
    status?: TeamProjectStatus;
    searchQuery?: string;
  }
) => {
  return apiClient.get<TeamProjectListResponse>(`/api/v1/teams/${teamId}/projects`, {
    query: { page, pageSize, ...filters }
  });
};

export const fetchTeamProject = (teamId: string, projectId: string) => {
  return apiClient.get<TeamProjectResponse>(`/api/v1/teams/${teamId}/projects/${projectId}`);
};

export const createTeamProject = (teamId: string, payload: CreateTeamProjectRequest) => {
  return apiClient.post<TeamProjectResponse>(`/api/v1/teams/${teamId}/projects`, payload);
};

export const updateTeamProject = (teamId: string, projectId: string, payload: UpdateTeamProjectRequest) => {
  return apiClient.patch<TeamProjectResponse>(`/api/v1/teams/${teamId}/projects/${projectId}`, payload);
};

export const deleteTeamProject = (teamId: string, projectId: string) => {
  return apiClient.delete<void>(`/api/v1/teams/${teamId}/projects/${projectId}`);
};
