import { apiRequest } from './client';

import type {
  ScriptListResponse,
  ScriptDetailResponse,
  ScriptStatsResponse,
  DriveAnalysisResponse,
  ScriptCreateRequest,
  ScriptUpdateRequest,
  ScriptScanRequest,
  DriveConflict,
  ScriptTag,
  BatchScript,
  PaginatedData,
  AuditLogEntry
} from '@workspace/shared';

export const fetchScriptList = (
  page = 1,
  pageSize = 20,
  filters?: {
    type?: 'batch' | 'powershell' | 'shell' | 'other';
    isActive?: boolean;
    driveLetter?: string;
    tagId?: string;
    searchQuery?: string;
  },
  signal?: AbortSignal
) => {
  return apiRequest<ScriptListResponse>('/api/v1/scripts', {
    query: {
      page,
      pageSize,
      ...filters
    },
    signal
  });
};

export const fetchScriptDetail = (scriptId: string) => {
  return apiRequest<ScriptDetailResponse>(`/api/v1/scripts/${scriptId}`);
};

export const createScript = (payload: ScriptCreateRequest) => {
  return apiRequest<ScriptDetailResponse>('/api/v1/scripts', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

export const updateScript = (scriptId: string, payload: ScriptUpdateRequest) => {
  return apiRequest<ScriptDetailResponse>(`/api/v1/scripts/${scriptId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
};

export const deleteScript = (scriptId: string) => {
  return apiRequest<void>(`/api/v1/scripts/${scriptId}`, {
    method: 'DELETE'
  });
};

export const scanScripts = (payload: ScriptScanRequest) => {
  return apiRequest<{ scripts: BatchScript[]; count: number }>('/api/v1/scripts/scan', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

export const fetchStats = () => {
  return apiRequest<ScriptStatsResponse>('/api/v1/scripts/stats');
};

export const fetchDriveAnalysis = () => {
  return apiRequest<DriveAnalysisResponse>('/api/v1/scripts/drives/analysis');
};

export const fetchConflicts = () => {
  return apiRequest<{ conflicts: DriveConflict[] }>('/api/v1/scripts/drives/conflicts');
};

export const fetchTags = () => {
  return apiRequest<{ tags: ScriptTag[] }>('/api/v1/scripts/tags');
};

export const createTag = (name: string, color?: string) => {
  return apiRequest<{ tag: ScriptTag }>('/api/v1/scripts/tags', {
    method: 'POST',
    body: JSON.stringify({ name, color })
  });
};

export const fetchScriptActivity = (scriptId: string, page = 1, pageSize = 50) => {
  return apiRequest<PaginatedData<AuditLogEntry>>(`/api/v1/scripts/${scriptId}/activity`, {
    query: { page, pageSize }
  });
};
