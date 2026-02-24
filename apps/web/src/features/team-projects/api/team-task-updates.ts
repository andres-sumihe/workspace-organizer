/**
 * Team Task Updates API client
 * Handles team task update (comments/progress notes) HTTP requests
 */

import { apiClient } from '@/api/client';

import type {
  TeamTaskUpdateListResponse,
  TeamTaskUpdateResponse,
  CreateTeamTaskUpdateRequest,
  UpdateTeamTaskUpdateRequest,
} from '@workspace/shared';

const basePath = (teamId: string, projectId: string, taskId: string) =>
  `/api/v1/teams/${teamId}/projects/${projectId}/tasks/${taskId}/updates`;

export const fetchTeamTaskUpdates = (teamId: string, projectId: string, taskId: string) => {
  return apiClient.get<TeamTaskUpdateListResponse>(basePath(teamId, projectId, taskId));
};

export const createTeamTaskUpdate = (
  teamId: string,
  projectId: string,
  taskId: string,
  payload: CreateTeamTaskUpdateRequest
) => {
  return apiClient.post<TeamTaskUpdateResponse>(basePath(teamId, projectId, taskId), payload);
};

export const updateTeamTaskUpdate = (
  teamId: string,
  projectId: string,
  taskId: string,
  updateId: string,
  payload: UpdateTeamTaskUpdateRequest
) => {
  return apiClient.patch<TeamTaskUpdateResponse>(
    `${basePath(teamId, projectId, taskId)}/${updateId}`,
    payload
  );
};

export const deleteTeamTaskUpdate = (
  teamId: string,
  projectId: string,
  taskId: string,
  updateId: string
) => {
  return apiClient.delete<void>(`${basePath(teamId, projectId, taskId)}/${updateId}`);
};
