import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  fetchTeamTasks,
  fetchTeamTask,
  createTeamTask,
  updateTeamTask,
  deleteTeamTask,
} from '@/features/team-projects/api/team-tasks';
import { queryKeys } from '@/lib/query-client';

import type {
  CreateTeamTaskRequest,
  UpdateTeamTaskRequest,
  TeamTaskStatus,
  TeamTaskPriority,
} from '@workspace/shared';

export interface TeamTaskListFilters {
  page?: number;
  pageSize?: number;
  status?: TeamTaskStatus;
  priority?: TeamTaskPriority;
  assignee?: string;
  searchQuery?: string;
}

export function useTeamTaskList(teamId: string, projectId: string, filters: TeamTaskListFilters = {}) {
  const { page = 1, pageSize = 20, ...rest } = filters;

  return useQuery({
    queryKey: queryKeys.teamTasks.list(teamId, projectId, { page, pageSize, ...rest }),
    queryFn: () => fetchTeamTasks(teamId, projectId, page, pageSize, rest),
    enabled: !!teamId && !!projectId,
  });
}

export function useTeamTaskDetail(teamId: string, projectId: string, taskId: string | null) {
  return useQuery({
    queryKey: queryKeys.teamTasks.detail(teamId, projectId, taskId ?? ''),
    queryFn: () => fetchTeamTask(teamId, projectId, taskId!),
    enabled: !!teamId && !!projectId && !!taskId,
  });
}

export function useCreateTeamTask(teamId: string, projectId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTeamTaskRequest) => createTeamTask(teamId, projectId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.teamTasks.lists() });
      // Also refresh project stats since task count changed
      qc.invalidateQueries({ queryKey: queryKeys.teamProjects.lists() });
    },
  });
}

export function useUpdateTeamTask(teamId: string, projectId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: UpdateTeamTaskRequest }) =>
      updateTeamTask(teamId, projectId, taskId, payload),
    onSuccess: (_data, { taskId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.teamTasks.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.teamTasks.detail(teamId, projectId, taskId) });
      // Refresh project stats if status changed
      qc.invalidateQueries({ queryKey: queryKeys.teamProjects.lists() });
    },
  });
}

export function useDeleteTeamTask(teamId: string, projectId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => deleteTeamTask(teamId, projectId, taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.teamTasks.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.teamProjects.lists() });
    },
  });
}
