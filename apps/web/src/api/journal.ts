import { apiClient } from './client';

import type {
  Tag,
  TagListResponse,
  TagResponse,
  CreateTagRequest,
  UpdateTagRequest,
  WorkLogEntry,
  WorkLogListResponse,
  WorkLogResponse,
  CreateWorkLogRequest,
  UpdateWorkLogRequest,
  RolloverWorkLogsRequest,
  RolloverWorkLogsResponse,
  PersonalProject,
  PersonalProjectDetail,
  PersonalProjectListResponse,
  PersonalProjectResponse,
  PersonalProjectDetailResponse,
  CreatePersonalProjectRequest,
  UpdatePersonalProjectRequest,
  TaskUpdate,
  TaskUpdateListResponse,
  TaskUpdateResponse,
  CreateTaskUpdateRequest,
  UpdateTaskUpdateRequest,
  TaskUpdateEntityType
} from '@workspace/shared';

// ============================================================================
// Tags API
// ============================================================================

export interface TagsListParams {
  // No filters currently, list all
}

export const tagsApi = {
  /**
   * List all tags
   */
  list: () => apiClient.get<TagListResponse>('/api/v1/tags'),

  /**
   * Get a tag by ID
   */
  getById: (id: string) => apiClient.get<TagResponse>(`/api/v1/tags/${id}`),

  /**
   * Create a new tag
   */
  create: (data: CreateTagRequest) => apiClient.post<TagResponse>('/api/v1/tags', data),

  /**
   * Update a tag
   */
  update: (id: string, data: UpdateTagRequest) =>
    apiClient.put<TagResponse>(`/api/v1/tags/${id}`, data),

  /**
   * Delete a tag
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/tags/${id}`);
  },

  /**
   * Search tags by name prefix (for autocomplete)
   */
  search: (query: string, limit?: number) =>
    apiClient.get<TagListResponse>('/api/v1/tags/search', {
      query: { q: query, limit: limit?.toString() }
    })
};

// ============================================================================
// Work Logs API
// ============================================================================

export interface WorkLogsListParams {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  projectId?: string;
  tagIds?: string[]; // comma-separated in query
  status?: string[]; // comma-separated in query
}

export const workLogsApi = {
  /**
   * List work logs with optional filters
   */
  list: (params?: WorkLogsListParams) => {
    const query: Record<string, string | undefined> = {};
    if (params?.from) query.from = params.from;
    if (params?.to) query.to = params.to;
    if (params?.projectId) query.projectId = params.projectId;
    if (params?.tagIds?.length) query.tagIds = params.tagIds.join(',');
    if (params?.status?.length) query.status = params.status.join(',');

    return apiClient.get<WorkLogListResponse>('/api/v1/work-logs', { query });
  },

  /**
   * Get a work log by ID
   */
  getById: (id: string) => apiClient.get<WorkLogResponse>(`/api/v1/work-logs/${id}`),

  /**
   * Create a new work log
   */
  create: (data: CreateWorkLogRequest) =>
    apiClient.post<WorkLogResponse>('/api/v1/work-logs', data),

  /**
   * Update a work log
   */
  update: (id: string, data: UpdateWorkLogRequest) =>
    apiClient.put<WorkLogResponse>(`/api/v1/work-logs/${id}`, data),

  /**
   * Delete a work log
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/work-logs/${id}`);
  },

  /**
   * Rollover unfinished work logs to a new date
   */
  rollover: (data: RolloverWorkLogsRequest) =>
    apiClient.post<RolloverWorkLogsResponse>('/api/v1/work-logs/rollover', data)
};

// ============================================================================
// Personal Projects API
// ============================================================================

export interface PersonalProjectsListParams {
  workspaceId?: string;
  status?: string[];
  tagIds?: string[];
}

export const personalProjectsApi = {
  /**
   * List personal projects with optional filters
   */
  list: (params?: PersonalProjectsListParams) => {
    const query: Record<string, string | undefined> = {};
    if (params?.workspaceId) query.workspaceId = params.workspaceId;
    if (params?.status?.length) query.status = params.status.join(',');
    if (params?.tagIds?.length) query.tagIds = params.tagIds.join(',');

    return apiClient.get<PersonalProjectListResponse>('/api/v1/personal-projects', { query });
  },

  /**
   * Get a project by ID (basic)
   */
  getById: (id: string) => apiClient.get<PersonalProjectResponse>(`/api/v1/personal-projects/${id}`),

  /**
   * Get detailed project information with linked tasks and workspace
   */
  getDetail: (id: string) =>
    apiClient.get<PersonalProjectDetailResponse>(`/api/v1/personal-projects/${id}/detail`),

  /**
   * Create a new project
   */
  create: (data: CreatePersonalProjectRequest) =>
    apiClient.post<PersonalProjectResponse>('/api/v1/personal-projects', data),

  /**
   * Update a project
   */
  update: (id: string, data: UpdatePersonalProjectRequest) =>
    apiClient.put<PersonalProjectResponse>(`/api/v1/personal-projects/${id}`, data),

  /**
   * Delete a project
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/personal-projects/${id}`);
  },

  /**
   * Search projects by title (for autocomplete)
   */
  search: (query: string) =>
    apiClient.get<PersonalProjectListResponse>('/api/v1/personal-projects/search', {
      query: { q: query }
    })
};

// ============================================================================
// Task Updates API
// ============================================================================

export const taskUpdatesApi = {
  /**
   * List task updates for an entity
   */
  listByEntity: (entityType: TaskUpdateEntityType, entityId: string) =>
    apiClient.get<TaskUpdateListResponse>('/api/v1/task-updates', {
      query: { entityType, entityId }
    }),

  /**
   * Get a task update by ID
   */
  getById: (id: string) => apiClient.get<TaskUpdateResponse>(`/api/v1/task-updates/${id}`),

  /**
   * Create a new task update
   */
  create: (data: CreateTaskUpdateRequest) =>
    apiClient.post<TaskUpdateResponse>('/api/v1/task-updates', data),

  /**
   * Update a task update
   */
  update: (id: string, data: UpdateTaskUpdateRequest) =>
    apiClient.put<TaskUpdateResponse>(`/api/v1/task-updates/${id}`, data),

  /**
   * Delete a task update
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/task-updates/${id}`);
  }
};

// Re-export types for convenience
export type { 
  Tag, 
  WorkLogEntry, 
  PersonalProject,
  PersonalProjectDetail,
  TaskUpdate,
  TaskUpdateEntityType,
  CreateTagRequest, 
  UpdateTagRequest, 
  CreateWorkLogRequest, 
  UpdateWorkLogRequest, 
  RolloverWorkLogsRequest,
  CreatePersonalProjectRequest,
  UpdatePersonalProjectRequest,
  CreateTaskUpdateRequest,
  UpdateTaskUpdateRequest
};
