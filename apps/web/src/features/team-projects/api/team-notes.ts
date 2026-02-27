/**
 * Team Notes API client
 * Handles all team-note-related HTTP requests (nested under projects)
 */

import { apiClient } from '@/api/client';

import type {
  TeamNoteListResponse,
  TeamNoteResponse,
  TeamNoteRevisionListResponse,
  TeamNoteRevisionDetailResponse,
  CreateTeamNoteRequest,
  UpdateTeamNoteRequest,
} from '@workspace/shared';

const basePath = (teamId: string, projectId: string) =>
  `/api/v1/teams/${teamId}/projects/${projectId}/notes`;

export const fetchTeamNotes = (
  teamId: string,
  projectId: string,
  page = 1,
  pageSize = 20,
  filters?: { searchQuery?: string }
) => {
  return apiClient.get<TeamNoteListResponse>(basePath(teamId, projectId), {
    query: { page, pageSize, ...filters }
  });
};

export const fetchTeamNote = (teamId: string, projectId: string, noteId: string) => {
  return apiClient.get<TeamNoteResponse>(`${basePath(teamId, projectId)}/${noteId}`);
};

export const createTeamNote = (teamId: string, projectId: string, payload: CreateTeamNoteRequest) => {
  return apiClient.post<TeamNoteResponse>(basePath(teamId, projectId), payload);
};

export const updateTeamNote = (teamId: string, projectId: string, noteId: string, payload: UpdateTeamNoteRequest) => {
  return apiClient.patch<TeamNoteResponse>(`${basePath(teamId, projectId)}/${noteId}`, payload);
};

export const deleteTeamNote = (teamId: string, projectId: string, noteId: string) => {
  return apiClient.delete<void>(`${basePath(teamId, projectId)}/${noteId}`);
};

export const fetchTeamNoteRevisions = (teamId: string, projectId: string, noteId: string) => {
  return apiClient.get<TeamNoteRevisionListResponse>(`${basePath(teamId, projectId)}/${noteId}/revisions`);
};

export const fetchTeamNoteRevisionDetail = (teamId: string, projectId: string, noteId: string, revisionId: string) => {
  return apiClient.get<TeamNoteRevisionDetailResponse>(`${basePath(teamId, projectId)}/${noteId}/revisions/${revisionId}`);
};

export const createManualSnapshot = (teamId: string, projectId: string, noteId: string, trigger: 'manual' | 'session_end' = 'manual') => {
  return apiClient.post<TeamNoteRevisionDetailResponse>(`${basePath(teamId, projectId)}/${noteId}/revisions`, { trigger });
};

export const restoreNoteRevision = (teamId: string, projectId: string, noteId: string, revisionId: string) => {
  return apiClient.post<TeamNoteResponse>(`${basePath(teamId, projectId)}/${noteId}/revisions/${revisionId}/restore`, {});
};
