import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateProjectChecklistItemRequest,
  GenerateProjectChecklistRequest,
  UpdateProjectChecklistItemRequest,
} from '@workspace/shared';

import {
  checklistTemplatesApi,
  projectChecklistsApi,
  type UploadChecklistTemplatePayload,
} from '@/features/checklists/api/checklist-templates';
import { queryKeys } from '@/lib/query-client';


export function useLocalChecklistTemplates() {
  return useQuery({
    queryKey: queryKeys.checklistTemplates.local(),
    queryFn: checklistTemplatesApi.listLocal,
  });
}

export function useTeamChecklistTemplates(teamId: string | null) {
  return useQuery({
    queryKey: queryKeys.checklistTemplates.team(teamId ?? ''),
    queryFn: () => checklistTemplatesApi.listTeam(teamId!),
    enabled: !!teamId,
  });
}

export function useUploadLocalChecklistTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UploadChecklistTemplatePayload) => checklistTemplatesApi.uploadLocal(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklistTemplates.local() });
    },
  });
}

export function useUploadTeamChecklistTemplate(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UploadChecklistTemplatePayload) => checklistTemplatesApi.uploadTeam(teamId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklistTemplates.team(teamId) });
    },
  });
}

export function useActivateLocalChecklistTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, versionId }: { templateId: string; versionId: string }) =>
      checklistTemplatesApi.activateLocal(templateId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklistTemplates.local() });
    },
  });
}

export function useActivateTeamChecklistTemplate(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, versionId }: { templateId: string; versionId: string }) =>
      checklistTemplatesApi.activateTeam(teamId, templateId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklistTemplates.team(teamId) });
    },
  });
}

export function useLocalProjectChecklist(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projectChecklists.local(projectId),
    queryFn: () => projectChecklistsApi.getLocal(projectId),
    enabled: !!projectId,
  });
}

export function useTeamProjectChecklist(teamId: string | null, projectId: string) {
  return useQuery({
    queryKey: queryKeys.projectChecklists.team(teamId ?? '', projectId),
    queryFn: () => projectChecklistsApi.getTeam(teamId!, projectId),
    enabled: !!teamId && !!projectId,
  });
}

export function useGenerateLocalProjectChecklist(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: GenerateProjectChecklistRequest) => projectChecklistsApi.generateLocal(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectChecklists.local(projectId) });
    },
  });
}

export function useGenerateTeamProjectChecklist(teamId: string, projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: GenerateProjectChecklistRequest) => projectChecklistsApi.generateTeam(teamId, projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectChecklists.team(teamId, projectId) });
    },
  });
}

export function useUpdateLocalProjectChecklistItem(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: UpdateProjectChecklistItemRequest }) =>
      projectChecklistsApi.updateLocalItem(projectId, itemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectChecklists.local(projectId) });
    },
  });
}

export function useCreateLocalProjectChecklistItem(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProjectChecklistItemRequest) => projectChecklistsApi.createLocalItem(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectChecklists.local(projectId) });
    },
  });
}

export function useDeleteLocalProjectChecklistItem(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => projectChecklistsApi.deleteLocalItem(projectId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectChecklists.local(projectId) });
    },
  });
}

export function useUpdateTeamProjectChecklistItem(teamId: string, projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: UpdateProjectChecklistItemRequest }) =>
      projectChecklistsApi.updateTeamItem(teamId, projectId, itemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectChecklists.team(teamId, projectId) });
    },
  });
}

export function useCreateTeamProjectChecklistItem(teamId: string, projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProjectChecklistItemRequest) => projectChecklistsApi.createTeamItem(teamId, projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectChecklists.team(teamId, projectId) });
    },
  });
}

export function useDeleteTeamProjectChecklistItem(teamId: string, projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => projectChecklistsApi.deleteTeamItem(teamId, projectId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectChecklists.team(teamId, projectId) });
    },
  });
}