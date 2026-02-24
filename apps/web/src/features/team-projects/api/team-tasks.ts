/**
 * Team Tasks API client
 * Handles all team-task-related HTTP requests (nested under projects)
 */

import { apiClient } from '@/api/client';

import type {
  TeamTaskListResponse,
  TeamTaskResponse,
  CreateTeamTaskRequest,
  UpdateTeamTaskRequest,
  TeamTaskStatus,
  TeamTaskPriority,
} from '@workspace/shared';

const basePath = (teamId: string, projectId: string) =>
  `/api/v1/teams/${teamId}/projects/${projectId}/tasks`;

export const fetchTeamTasks = (
  teamId: string,
  projectId: string,
  page = 1,
  pageSize = 20,
  filters?: {
    status?: TeamTaskStatus;
    priority?: TeamTaskPriority;
    assignee?: string;
    searchQuery?: string;
  }
) => {
  return apiClient.get<TeamTaskListResponse>(basePath(teamId, projectId), {
    query: { page, pageSize, ...filters }
  });
};

export const fetchTeamTask = (teamId: string, projectId: string, taskId: string) => {
  return apiClient.get<TeamTaskResponse>(`${basePath(teamId, projectId)}/${taskId}`);
};

export const createTeamTask = (teamId: string, projectId: string, payload: CreateTeamTaskRequest) => {
  return apiClient.post<TeamTaskResponse>(basePath(teamId, projectId), payload);
};

export const updateTeamTask = (teamId: string, projectId: string, taskId: string, payload: UpdateTeamTaskRequest) => {
  return apiClient.patch<TeamTaskResponse>(`${basePath(teamId, projectId)}/${taskId}`, payload);
};

export const deleteTeamTask = (teamId: string, projectId: string, taskId: string) => {
  return apiClient.delete<void>(`${basePath(teamId, projectId)}/${taskId}`);
};
