import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  fetchTeamNotes,
  fetchTeamNote,
  fetchTeamNoteRevisions,
  createTeamNote,
  updateTeamNote,
  deleteTeamNote,
} from '@/features/team-projects/api/team-notes';
import { queryKeys } from '@/lib/query-client';

import type { CreateTeamNoteRequest, UpdateTeamNoteRequest } from '@workspace/shared';

export interface TeamNoteListFilters {
  page?: number;
  pageSize?: number;
  searchQuery?: string;
}

export function useTeamNoteList(teamId: string, projectId: string, filters: TeamNoteListFilters = {}) {
  const { page = 1, pageSize = 20, ...rest } = filters;

  return useQuery({
    queryKey: queryKeys.teamNotes.list(teamId, projectId, { page, pageSize, ...rest }),
    queryFn: () => fetchTeamNotes(teamId, projectId, page, pageSize, rest),
    enabled: !!teamId && !!projectId,
  });
}

export function useTeamNoteDetail(teamId: string, projectId: string, noteId: string | null) {
  return useQuery({
    queryKey: queryKeys.teamNotes.detail(teamId, projectId, noteId ?? ''),
    queryFn: () => fetchTeamNote(teamId, projectId, noteId!),
    enabled: !!teamId && !!projectId && !!noteId,
  });
}

export function useTeamNoteRevisions(teamId: string, projectId: string, noteId: string | null) {
  return useQuery({
    queryKey: queryKeys.teamNotes.revisions(teamId, projectId, noteId ?? ''),
    queryFn: () => fetchTeamNoteRevisions(teamId, projectId, noteId!),
    enabled: !!teamId && !!projectId && !!noteId,
  });
}

export function useCreateTeamNote(teamId: string, projectId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTeamNoteRequest) => createTeamNote(teamId, projectId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.teamNotes.lists() });
    },
  });
}

export function useUpdateTeamNote(teamId: string, projectId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, payload }: { noteId: string; payload: UpdateTeamNoteRequest }) =>
      updateTeamNote(teamId, projectId, noteId, payload),
    onSuccess: (_data, { noteId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.teamNotes.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.teamNotes.detail(teamId, projectId, noteId) });
      qc.invalidateQueries({ queryKey: queryKeys.teamNotes.revisions(teamId, projectId, noteId) });
    },
  });
}

export function useDeleteTeamNote(teamId: string, projectId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => deleteTeamNote(teamId, projectId, noteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.teamNotes.lists() });
    },
  });
}
