import { apiRequest } from './client';

import type {
  ControlMJobListResponse,
  ControlMJobDetailResponse,
  ControlMJobStatsResponse,
  ControlMImportResult,
  JobDependencyGraph
} from '@workspace/shared';

export const fetchJobList = (
  page = 1,
  pageSize = 20,
  filters?: {
    application?: string;
    nodeId?: string;
    taskType?: string;
    isActive?: boolean;
    searchQuery?: string;
  },
  signal?: AbortSignal
) => {
  return apiRequest<ControlMJobListResponse>('/api/v1/controlm-jobs', {
    query: {
      page,
      pageSize,
      ...filters
    },
    signal
  });
};

export const fetchJobDetail = (jobId: string) => {
  return apiRequest<ControlMJobDetailResponse>(`/api/v1/controlm-jobs/${jobId}`);
};

export const fetchJobStats = () => {
  return apiRequest<ControlMJobStatsResponse>('/api/v1/controlm-jobs/stats');
};

export const fetchJobFilters = () => {
  return apiRequest<{ applications: string[]; nodes: string[] }>('/api/v1/controlm-jobs/filters');
};

export const fetchDependencyGraph = (filters?: { application?: string; nodeId?: string }) => {
  return apiRequest<JobDependencyGraph>('/api/v1/controlm-jobs/graph', {
    query: filters
  });
};

export const importJobs = (csvContent: string, replaceExisting = false) => {
  return apiRequest<ControlMImportResult>('/api/v1/controlm-jobs/import', {
    method: 'POST',
    body: JSON.stringify({ csvContent, replaceExisting })
  });
};

export const deleteJob = (jobId: string) => {
  return apiRequest<void>(`/api/v1/controlm-jobs/${jobId}`, {
    method: 'DELETE'
  });
};

export const clearAllJobs = () => {
  return apiRequest<{ deletedCount: number }>('/api/v1/controlm-jobs', {
    method: 'DELETE'
  });
};

export const linkJobToScript = (jobId: string, scriptId: string) => {
  return apiRequest<ControlMJobDetailResponse>(`/api/v1/controlm-jobs/${jobId}/link-script`, {
    method: 'POST',
    body: JSON.stringify({ scriptId })
  });
};
