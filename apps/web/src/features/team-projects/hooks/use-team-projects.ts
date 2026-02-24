import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  fetchTeamProjects,
  fetchTeamProject,
  createTeamProject,
  updateTeamProject,
  deleteTeamProject,
} from '@/features/team-projects/api/team-projects';
import { queryKeys } from '@/lib/query-client';

import type { TeamProjectStatus, CreateTeamProjectRequest, UpdateTeamProjectRequest } from '@workspace/shared';

export interface TeamProjectListFilters {
  page?: number;
  pageSize?: number;
  status?: TeamProjectStatus;
  searchQuery?: string;
}

export function useTeamProjectList(teamId: string, filters: TeamProjectListFilters = {}) {
  const { page = 1, pageSize = 20, ...rest } = filters;

  return useQuery({
    queryKey: queryKeys.teamProjects.list(teamId, { page, pageSize, ...rest }),
    queryFn: () => fetchTeamProjects(teamId, page, pageSize, rest),
    enabled: !!teamId,
  });
}

export function useTeamProjectDetail(teamId: string, projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.teamProjects.detail(teamId, projectId ?? ''),
    queryFn: () => fetchTeamProject(teamId, projectId!),
    enabled: !!teamId && !!projectId,
  });
}

export function useCreateTeamProject(teamId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTeamProjectRequest) => createTeamProject(teamId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.teamProjects.lists() });
    },
  });
}

export function useUpdateTeamProject(teamId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, payload }: { projectId: string; payload: UpdateTeamProjectRequest }) =>
      updateTeamProject(teamId, projectId, payload),
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.teamProjects.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.teamProjects.detail(teamId, projectId) });
    },
  });
}

export function useDeleteTeamProject(teamId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => deleteTeamProject(teamId, projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.teamProjects.lists() });
    },
  });
}
