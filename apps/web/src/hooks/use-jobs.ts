import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  fetchJobList,
  fetchJobDetail,
  fetchJobStats,
  fetchJobFilters,
  fetchDependencyGraph,
  importJobs,
  deleteJob,
  clearAllJobs,
  linkJobToScript,
} from '@/api/controlm-jobs';
import { queryKeys } from '@/lib/query-client';

/** Filters for job list query */
export interface JobListFilters {
  page?: number;
  pageSize?: number;
  application?: string;
  nodeId?: string;
  taskType?: string;
  isActive?: boolean;
  searchQuery?: string;
}

/**
 * Hook to fetch paginated Control-M job list with caching
 */
export function useJobList(filters: JobListFilters = {}) {
  const { page = 1, pageSize = 20, ...rest } = filters;
  
  return useQuery({
    queryKey: queryKeys.jobs.list({ page, pageSize, ...rest }),
    queryFn: ({ signal }) => fetchJobList(page, pageSize, rest, signal),
  });
}

/**
 * Hook to fetch a single job's details
 */
export function useJobDetail(jobId: string | null) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(jobId ?? ''),
    queryFn: () => fetchJobDetail(jobId!),
    enabled: !!jobId,
  });
}

/**
 * Hook to fetch job statistics
 */
export function useJobStats() {
  return useQuery({
    queryKey: queryKeys.jobs.stats(),
    queryFn: fetchJobStats,
  });
}

/**
 * Hook to fetch job filter options (applications, nodes)
 */
export function useJobFilters() {
  return useQuery({
    queryKey: [...queryKeys.jobs.all, 'filters'] as const,
    queryFn: fetchJobFilters,
    staleTime: 60 * 1000, // Filter options change less frequently
  });
}

/**
 * Hook to fetch dependency graph
 */
export function useDependencyGraph(filters?: { application?: string; nodeId?: string }) {
  return useQuery({
    queryKey: [...queryKeys.jobs.all, 'graph', filters] as const,
    queryFn: () => fetchDependencyGraph(filters),
    enabled: true,
  });
}

/**
 * Mutation hook for importing jobs from CSV
 */
export function useImportJobs() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ csvContent, replaceExisting }: { csvContent: string; replaceExisting?: boolean }) =>
      importJobs(csvContent, replaceExisting),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}

/**
 * Mutation hook for deleting a job
 */
export function useDeleteJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (jobId: string) => deleteJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}

/**
 * Mutation hook for clearing all jobs
 */
export function useClearAllJobs() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => clearAllJobs(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
  });
}

/**
 * Mutation hook for linking a job to a script
 */
export function useLinkJobToScript() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ jobId, scriptId }: { jobId: string; scriptId: string }) =>
      linkJobToScript(jobId, scriptId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(variables.jobId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.lists() });
    },
  });
}
