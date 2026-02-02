import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { CreatePersonalProjectRequest, UpdatePersonalProjectRequest } from '@workspace/shared';

import { personalProjectsApi, type PersonalProjectsListParams } from '@/api/journal';
import { queryKeys } from '@/lib/query-client';

/**
 * Hook to fetch personal projects list with optional filters
 * Cached and automatically invalidated on mutations
 */
export function usePersonalProjectsList(params?: PersonalProjectsListParams) {
  return useQuery({
    queryKey: queryKeys.personalProjects.list(params as Record<string, unknown> | undefined),
    queryFn: () => personalProjectsApi.list(params),
  });
}

/**
 * Hook to fetch a single personal project by ID
 */
export function usePersonalProjectDetail(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.personalProjects.detail(projectId ?? ''),
    queryFn: () => personalProjectsApi.getById(projectId!),
    enabled: !!projectId,
  });
}

/**
 * Hook to fetch detailed personal project info (with linked tasks and workspace)
 */
export function usePersonalProjectDetailFull(projectId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.personalProjects.detail(projectId ?? ''), 'full'],
    queryFn: () => personalProjectsApi.getDetail(projectId!),
    enabled: !!projectId,
  });
}

/**
 * Mutation hook for creating a new personal project
 * Invalidates personal projects list cache on success
 */
export function useCreatePersonalProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePersonalProjectRequest) => personalProjectsApi.create(data),
    onSuccess: () => {
      // Invalidate all personal projects queries
      queryClient.invalidateQueries({ queryKey: queryKeys.personalProjects.all });
    },
  });
}

/**
 * Mutation hook for updating an existing personal project
 * Invalidates specific project and list cache on success
 */
export function useUpdatePersonalProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: UpdatePersonalProjectRequest }) =>
      personalProjectsApi.update(projectId, data),
    onSuccess: (_, variables) => {
      // Invalidate the specific project detail
      queryClient.invalidateQueries({ queryKey: queryKeys.personalProjects.detail(variables.projectId) });
      // Invalidate lists since project might affect sorting/filtering
      queryClient.invalidateQueries({ queryKey: queryKeys.personalProjects.lists() });
    },
  });
}

/**
 * Mutation hook for deleting a personal project
 * Invalidates all personal projects queries on success
 */
export function useDeletePersonalProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => personalProjectsApi.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.personalProjects.all });
    },
  });
}
