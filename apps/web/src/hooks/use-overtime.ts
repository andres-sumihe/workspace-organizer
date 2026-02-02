import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { CreateOvertimeEntryRequest, ToolsGeneralSettings } from '@workspace/shared';

import { toolsApi, type OvertimeEntriesParams } from '@/api/tools';
import { queryKeys } from '@/lib/query-client';

/**
 * Hook to fetch tools general settings (base salary, etc.)
 * Used by overtime calculator
 */
export function useToolsGeneralSettings() {
  return useQuery({
    queryKey: queryKeys.settings.toolsGeneral(),
    queryFn: () => toolsApi.getGeneralSettings(),
  });
}

/**
 * Mutation hook for updating tools general settings
 */
export function useUpdateToolsGeneralSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<ToolsGeneralSettings>) => toolsApi.updateGeneralSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.toolsGeneral() });
    },
  });
}

/**
 * Hook to fetch overtime entries list with optional date range filter
 * Cached and automatically invalidated on mutations
 */
export function useOvertimeList(params?: OvertimeEntriesParams) {
  return useQuery({
    queryKey: queryKeys.overtime.list(params as Record<string, unknown> | undefined),
    queryFn: () => toolsApi.listOvertimeEntries(params),
  });
}

/**
 * Hook to fetch overtime statistics for a date range
 */
export function useOvertimeStats(params?: OvertimeEntriesParams) {
  return useQuery({
    queryKey: queryKeys.overtime.stats(params as Record<string, unknown> | undefined),
    queryFn: () => toolsApi.getOvertimeStatistics(params),
  });
}

/**
 * Mutation hook for creating a new overtime entry
 * Invalidates overtime list and stats cache on success
 */
export function useCreateOvertimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOvertimeEntryRequest) => toolsApi.createOvertimeEntry(data),
    onSuccess: () => {
      // Invalidate all overtime queries (list and stats)
      queryClient.invalidateQueries({ queryKey: queryKeys.overtime.all });
    },
  });
}

/**
 * Mutation hook for deleting an overtime entry
 * Invalidates all overtime queries on success
 */
export function useDeleteOvertimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (entryId: string) => toolsApi.deleteOvertimeEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.overtime.all });
    },
  });
}
