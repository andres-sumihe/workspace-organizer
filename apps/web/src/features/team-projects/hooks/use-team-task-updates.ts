import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  fetchTeamTaskUpdates,
  createTeamTaskUpdate,
  updateTeamTaskUpdate,
  deleteTeamTaskUpdate,
} from '@/features/team-projects/api/team-task-updates';
import { queryKeys } from '@/lib/query-client';

import type { CreateTeamTaskUpdateRequest, UpdateTeamTaskUpdateRequest } from '@workspace/shared';

export function useTeamTaskUpdates(teamId: string, projectId: string, taskId: string) {
  return useQuery({
    queryKey: queryKeys.teamTaskUpdates.list(teamId, projectId, taskId),
    queryFn: () => fetchTeamTaskUpdates(teamId, projectId, taskId),
    enabled: !!teamId && !!projectId && !!taskId,
  });
}

export function useCreateTeamTaskUpdate(teamId: string, projectId: string, taskId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTeamTaskUpdateRequest) =>
      createTeamTaskUpdate(teamId, projectId, taskId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.teamTaskUpdates.list(teamId, projectId, taskId) });
    },
  });
}

export function useUpdateTeamTaskUpdate(teamId: string, projectId: string, taskId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ updateId, payload }: { updateId: string; payload: UpdateTeamTaskUpdateRequest }) =>
      updateTeamTaskUpdate(teamId, projectId, taskId, updateId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.teamTaskUpdates.list(teamId, projectId, taskId) });
    },
  });
}

export function useDeleteTeamTaskUpdate(teamId: string, projectId: string, taskId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (updateId: string) =>
      deleteTeamTaskUpdate(teamId, projectId, taskId, updateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.teamTaskUpdates.list(teamId, projectId, taskId) });
    },
  });
}
