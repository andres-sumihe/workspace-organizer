import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { CreateWorkLogRequest, UpdateWorkLogRequest, RolloverWorkLogsRequest } from '@workspace/shared';

import { workLogsApi, type WorkLogsListParams } from '@/api/journal';
import { queryKeys } from '@/lib/query-client';

/**
 * Hook to fetch work logs list with optional filters
 * Cached and automatically invalidated on mutations
 */
export function useWorkLogsList(params?: WorkLogsListParams) {
  return useQuery({
    queryKey: queryKeys.workLogs.list(params as Record<string, unknown> | undefined),
    queryFn: () => workLogsApi.list(params),
  });
}

/**
 * Hook to fetch a single work log by ID
 */
export function useWorkLogDetail(workLogId: string | null) {
  return useQuery({
    queryKey: queryKeys.workLogs.detail(workLogId ?? ''),
    queryFn: () => workLogsApi.getById(workLogId!),
    enabled: !!workLogId,
  });
}

/**
 * Mutation hook for creating a new work log
 * Invalidates work logs list and dashboard queries on success
 */
export function useCreateWorkLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWorkLogRequest) => workLogsApi.create(data),
    onSuccess: () => {
      // Invalidate all work log queries
      queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.all });
    },
  });
}

/**
 * Mutation hook for updating an existing work log
 * Invalidates specific work log and list cache on success
 */
export function useUpdateWorkLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workLogId, data }: { workLogId: string; data: UpdateWorkLogRequest }) =>
      workLogsApi.update(workLogId, data),
    onSuccess: (_, variables) => {
      // Invalidate the specific work log detail
      queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.detail(variables.workLogId) });
      // Invalidate lists since work log might affect sorting/filtering
      queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.lists() });
    },
  });
}

/**
 * Mutation hook for deleting a work log
 * Invalidates all work log queries on success
 */
export function useDeleteWorkLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workLogId: string) => workLogsApi.delete(workLogId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.all });
    },
  });
}

/**
 * Mutation hook for rolling over unfinished work logs to a new date
 * Invalidates all work log queries on success
 */
export function useRolloverWorkLogs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RolloverWorkLogsRequest) => workLogsApi.rollover(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.all });
    },
  });
}
