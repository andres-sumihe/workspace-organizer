import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  fetchTeamNotes,
  fetchTeamNote,
  fetchTeamNoteRevisions,
  fetchTeamNoteRevisionDetail,
  createManualSnapshot,
  restoreNoteRevision,
  createTeamNote,
  updateTeamNote,
  deleteTeamNote,
} from '@/features/team-projects/api/team-notes';
import { queryKeys } from '@/lib/query-client';

import type { CreateTeamNoteRequest, UpdateTeamNoteRequest } from '@workspace/shared';

// Team data is shared across users — keep staleTime short so refetches
// triggered by SSE events pick up fresh data quickly.
const TEAM_QUERY_OPTIONS = {
  staleTime: 5_000,
  refetchOnWindowFocus: true as const,
};

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
    ...TEAM_QUERY_OPTIONS,
  });
}

export function useTeamNoteDetail(teamId: string, projectId: string, noteId: string | null) {
  return useQuery({
    queryKey: queryKeys.teamNotes.detail(teamId, projectId, noteId ?? ''),
    queryFn: () => fetchTeamNote(teamId, projectId, noteId!),
    enabled: !!teamId && !!projectId && !!noteId,
    ...TEAM_QUERY_OPTIONS,
  });
}

export function useTeamNoteRevisions(teamId: string, projectId: string, noteId: string | null) {
  return useQuery({
    queryKey: queryKeys.teamNotes.revisions(teamId, projectId, noteId ?? ''),
    queryFn: () => fetchTeamNoteRevisions(teamId, projectId, noteId!),
    enabled: !!teamId && !!projectId && !!noteId,
    ...TEAM_QUERY_OPTIONS,
  });
}

export function useTeamNoteRevisionDetail(teamId: string, projectId: string, noteId: string, revisionId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.teamNotes.revisions(teamId, projectId, noteId), revisionId],
    queryFn: () => fetchTeamNoteRevisionDetail(teamId, projectId, noteId, revisionId!),
    enabled: !!teamId && !!projectId && !!noteId && !!revisionId,
    ...TEAM_QUERY_OPTIONS,
  });
}

export function useCreateNoteSnapshot(teamId: string, projectId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => createManualSnapshot(teamId, projectId, noteId),
    onSuccess: (_data, noteId) => {
      qc.invalidateQueries({ queryKey: queryKeys.teamNotes.revisions(teamId, projectId, noteId) });
    },
  });
}

export function useRestoreNoteRevision(teamId: string, projectId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, revisionId }: { noteId: string; revisionId: string }) =>
      restoreNoteRevision(teamId, projectId, noteId, revisionId),
    onSuccess: (_data, { noteId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.teamNotes.revisions(teamId, projectId, noteId) });
      qc.invalidateQueries({ queryKey: queryKeys.teamNotes.detail(teamId, projectId, noteId) });
    },
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
