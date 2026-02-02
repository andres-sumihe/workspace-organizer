import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { CreateTagRequest, UpdateTagRequest } from '@workspace/shared';

import { tagsApi } from '@/api/journal';
import { queryKeys } from '@/lib/query-client';

/**
 * Hook to fetch all tags
 * Cached and automatically invalidated on mutations
 */
export function useTagsList() {
  return useQuery({
    queryKey: queryKeys.tags.list(),
    queryFn: () => tagsApi.list(),
  });
}

/**
 * Mutation hook for creating a new tag
 * Invalidates tags list cache on success
 */
export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTagRequest) => tagsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
  });
}

/**
 * Mutation hook for updating a tag
 * Invalidates tags list cache on success
 */
export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tagId, data }: { tagId: string; data: UpdateTagRequest }) =>
      tagsApi.update(tagId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
  });
}

/**
 * Mutation hook for deleting a tag
 * Invalidates tags list cache on success
 */
export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tagId: string) => tagsApi.delete(tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all });
    },
  });
}
