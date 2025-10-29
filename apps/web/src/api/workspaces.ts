import { apiRequest } from './client';

import type { WorkspaceListResponse } from '@workspace/shared';

export const fetchWorkspaceList = (page = 1, pageSize = 6, signal?: AbortSignal) => {
  return apiRequest<WorkspaceListResponse>('/api/v1/workspaces', {
    query: {
      page,
      pageSize,
    },
    signal,
  });
};
