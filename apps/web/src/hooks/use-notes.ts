import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { CreateNoteRequest, UpdateNoteRequest } from '@workspace/shared';

import { notesApi, type NotesListParams } from '@/api/notes-vault';
import { queryKeys } from '@/lib/query-client';

/**
 * Hook to fetch notes list with optional filters
 * Cached and automatically invalidated on mutations
 */
export function useNotesList(params?: NotesListParams) {
  return useQuery({
    queryKey: queryKeys.notes.list(params as Record<string, unknown> | undefined),
    queryFn: () => notesApi.list(params),
  });
}

/**
 * Hook to fetch a single note by ID
 */
export function useNoteDetail(noteId: string | null) {
  return useQuery({
    queryKey: queryKeys.notes.detail(noteId ?? ''),
    queryFn: () => notesApi.getById(noteId!),
    enabled: !!noteId,
  });
}

/**
 * Mutation hook for creating a new note
 * Invalidates notes list cache on success
 */
export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNoteRequest) => notesApi.create(data),
    onSuccess: () => {
      // Invalidate all notes queries to reflect new note
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
    },
  });
}

/**
 * Mutation hook for updating an existing note
 * Invalidates specific note and list cache on success
 */
export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, data }: { noteId: string; data: UpdateNoteRequest }) =>
      notesApi.update(noteId, data),
    onSuccess: (_, variables) => {
      // Invalidate the specific note detail
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.detail(variables.noteId) });
      // Invalidate lists since note might affect sorting/filtering (e.g., pinned status)
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.lists() });
    },
  });
}

/**
 * Mutation hook for deleting a note
 * Invalidates all notes queries on success
 */
export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => notesApi.delete(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
    },
  });
}
