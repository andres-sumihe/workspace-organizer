import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type {
  ScriptCreateRequest,
  ScriptUpdateRequest,
  ScriptType,
} from '@workspace/shared';

import {
  fetchScriptList,
  fetchScriptDetail,
  fetchStats,
  fetchDriveAnalysis,
  fetchConflicts,
  fetchTags,
  fetchScriptActivity,
  createScript,
  updateScript,
  deleteScript,
} from '@/api/scripts';
import { queryKeys } from '@/lib/query-client';

/** Filters for script list query */
export interface ScriptListFilters {
  page?: number;
  pageSize?: number;
  type?: ScriptType;
  isActive?: boolean;
  driveLetter?: string;
  tagId?: string;
  searchQuery?: string;
}

/**
 * Hook to fetch paginated script list with caching
 * Cache is invalidated when mutations occur
 */
export function useScriptList(filters: ScriptListFilters = {}) {
  const { page = 1, pageSize = 20, ...rest } = filters;
  
  return useQuery({
    queryKey: queryKeys.scripts.list({ page, pageSize, ...rest }),
    queryFn: ({ signal }) => fetchScriptList(page, pageSize, rest, signal),
  });
}

/**
 * Hook to fetch a single script's details
 * Cached per script ID
 */
export function useScriptDetail(scriptId: string | null) {
  return useQuery({
    queryKey: queryKeys.scripts.detail(scriptId ?? ''),
    queryFn: () => fetchScriptDetail(scriptId!),
    enabled: !!scriptId, // Only run when scriptId is provided
  });
}

/**
 * Hook to fetch script statistics
 * Cached globally with 30s stale time
 */
export function useScriptStats() {
  return useQuery({
    queryKey: queryKeys.scripts.stats(),
    queryFn: fetchStats,
  });
}

/**
 * Hook to fetch drive analysis data
 * Used by Drive Mappings tab
 */
export function useDriveAnalysis() {
  return useQuery({
    queryKey: queryKeys.scripts.driveAnalysis(),
    queryFn: fetchDriveAnalysis,
  });
}

/**
 * Hook to fetch drive conflicts
 */
export function useDriveConflicts() {
  return useQuery({
    queryKey: queryKeys.scripts.conflicts(),
    queryFn: fetchConflicts,
  });
}

/**
 * Hook to fetch all tags
 */
export function useScriptTags() {
  return useQuery({
    queryKey: queryKeys.scripts.tags(),
    queryFn: fetchTags,
  });
}

/**
 * Hook to fetch script activity/audit logs
 */
export function useScriptActivity(scriptId: string, page = 1, pageSize = 50) {
  return useQuery({
    queryKey: queryKeys.scripts.activity(scriptId, page),
    queryFn: () => fetchScriptActivity(scriptId, page, pageSize),
    enabled: !!scriptId,
  });
}

/**
 * Mutation hook for creating a new script
 * Invalidates script list and stats cache on success
 */
export function useCreateScript() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (payload: ScriptCreateRequest) => createScript(payload),
    onSuccess: () => {
      // Invalidate related queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.scripts.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.scripts.stats() });
      queryClient.invalidateQueries({ queryKey: queryKeys.scripts.driveAnalysis() });
      queryClient.invalidateQueries({ queryKey: queryKeys.scripts.conflicts() });
    },
  });
}

/**
 * Mutation hook for updating an existing script
 * Invalidates specific script detail and list cache
 */
export function useUpdateScript() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ scriptId, payload }: { scriptId: string; payload: ScriptUpdateRequest }) =>
      updateScript(scriptId, payload),
    onSuccess: (_, variables) => {
      // Invalidate the specific script detail
      queryClient.invalidateQueries({ queryKey: queryKeys.scripts.detail(variables.scriptId) });
      // Invalidate lists since script data might affect sorting/filtering
      queryClient.invalidateQueries({ queryKey: queryKeys.scripts.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.scripts.driveAnalysis() });
      queryClient.invalidateQueries({ queryKey: queryKeys.scripts.conflicts() });
    },
  });
}

/**
 * Mutation hook for deleting a script
 * Invalidates all script-related queries
 */
export function useDeleteScript() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (scriptId: string) => deleteScript(scriptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scripts.all });
    },
  });
}
