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
  RolloverWorkLogsResponse
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

// Re-export types for convenience
export type { Tag, WorkLogEntry, CreateTagRequest, UpdateTagRequest, CreateWorkLogRequest, UpdateWorkLogRequest, RolloverWorkLogsRequest };
