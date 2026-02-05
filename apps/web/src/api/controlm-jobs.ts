import { apiRequest } from './client';

import type {
  ControlMJobListResponse,
  ControlMJobDetailResponse,
  ControlMJobStatsResponse,
  ControlMImportResult,
  JobDependencyGraph,
  ControlMTaskType,
  ControlMJob
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

export const unlinkJobFromScript = (jobId: string) => {
  return apiRequest<ControlMJobDetailResponse>(`/api/v1/controlm-jobs/${jobId}/link-script`, {
    method: 'DELETE'
  });
};

export interface ScriptSuggestion {
  script: { id: string; name: string };
  matchType: string;
  confidence: number;
}

export const fetchScriptSuggestions = (jobId: string) => {
  return apiRequest<{ suggestions: ScriptSuggestion[] }>(
    `/api/v1/controlm-jobs/${jobId}/script-suggestions`
  );
};

export interface LinkingStatusReport {
  totalJobs: number;
  jobsWithMemName: number;
  linkedJobs: number;
  unlinkedJobs: number;
  linkingPercentage: number;
}

export const fetchLinkingStatus = () => {
  return apiRequest<LinkingStatusReport>('/api/v1/controlm-jobs/linking-status');
};

export interface AutoLinkResult {
  totalJobsWithScripts: number;
  alreadyLinked: number;
  newlyLinked: number;
  noMatchFound: number;
  links: Array<{
    jobId: string;
    jobName: string;
    memName: string;
    scriptId: string;
    scriptName: string;
  }>;
  unmatched: Array<{
    jobId: string;
    jobName: string;
    memName: string;
  }>;
}

export const autoLinkJobs = () => {
  return apiRequest<AutoLinkResult>('/api/v1/controlm-jobs/auto-link', {
    method: 'POST'
  });
};

// ---- Create and Update Job ----

export interface CreateJobRequest {
  jobName: string;
  application: string;
  groupName: string;
  nodeId: string;
  description?: string;
  memName?: string;
  memLib?: string;
  owner?: string;
  taskType?: ControlMTaskType;
  isCyclic?: boolean;
  priority?: string;
  isCritical?: boolean;
  daysCalendar?: string;
  weeksCalendar?: string;
  fromTime?: string;
  toTime?: string;
  interval?: string;
  isActive?: boolean;
  linkedScriptId?: string;
}

export interface UpdateJobRequest {
  jobName?: string;
  description?: string;
  memName?: string;
  memLib?: string;
  owner?: string;
  taskType?: ControlMTaskType;
  isCyclic?: boolean;
  priority?: string;
  isCritical?: boolean;
  daysCalendar?: string;
  weeksCalendar?: string;
  fromTime?: string;
  toTime?: string;
  interval?: string;
  isActive?: boolean;
  linkedScriptId?: string | null;
}

export const createJob = (payload: CreateJobRequest) => {
  return apiRequest<{ job: ControlMJob }>('/api/v1/controlm-jobs', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

export const updateJob = (jobId: string, payload: UpdateJobRequest) => {
  return apiRequest<{ job: ControlMJob }>(`/api/v1/controlm-jobs/${jobId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
};
