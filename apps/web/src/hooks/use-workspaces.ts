import { useQuery } from '@tanstack/react-query';

import { workspacesApi, type WorkspacesListParams } from '@/api/workspaces';
import { queryKeys } from '@/lib/query-client';

/**
 * Hook to fetch workspaces list with pagination
 * Cached for dashboard, projects page, and other components
 */
export function useWorkspacesList(params?: WorkspacesListParams) {
  return useQuery({
    queryKey: queryKeys.workspaces.list(params as Record<string, unknown> || {}),
    queryFn: () => workspacesApi.list(params),
  });
}

/**
 * Hook to fetch a single workspace by ID
 */
export function useWorkspaceDetail(workspaceId: string | null) {
  return useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId ?? ''),
    queryFn: () => workspacesApi.getById(workspaceId!),
    enabled: !!workspaceId,
  });
}
