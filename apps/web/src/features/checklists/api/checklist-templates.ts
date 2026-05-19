import type {
  ChecklistTemplateListResponse,
  ChecklistTemplateResponse,
  CreateProjectChecklistItemRequest,
  GenerateProjectChecklistRequest,
  ProjectChecklistResponse,
  UpdateProjectChecklistItemRequest,
} from '@workspace/shared';

import { apiBlobRequest, apiClient, apiFormDataRequest } from '@/api/client';


export interface UploadChecklistTemplatePayload {
  file: File;
  templateId?: string;
  name?: string;
  description?: string;
  versionLabel?: string;
  activate?: boolean;
}

const appendOptional = (formData: FormData, key: string, value: string | boolean | undefined) => {
  if (value === undefined) return;
  const normalized = typeof value === 'boolean' ? String(value) : value.trim();
  if (normalized.length === 0) return;
  formData.append(key, normalized);
};

const toFormData = (payload: UploadChecklistTemplatePayload) => {
  const formData = new FormData();
  formData.append('template', payload.file);
  appendOptional(formData, 'templateId', payload.templateId);
  appendOptional(formData, 'name', payload.name);
  appendOptional(formData, 'description', payload.description);
  appendOptional(formData, 'versionLabel', payload.versionLabel);
  appendOptional(formData, 'activate', payload.activate);
  return formData;
};

export const checklistTemplatesApi = {
  listLocal: () => apiClient.get<ChecklistTemplateListResponse>('/api/v1/checklist-templates'),

  uploadLocal: (payload: UploadChecklistTemplatePayload) =>
    apiFormDataRequest<ChecklistTemplateResponse>('/api/v1/checklist-templates', toFormData(payload)),

  activateLocal: (templateId: string, versionId: string) =>
    apiClient.patch<ChecklistTemplateResponse>(`/api/v1/checklist-templates/${templateId}/versions/${versionId}/activate`, {}),

  downloadLocal: (templateId: string, versionId: string) =>
    apiBlobRequest(`/api/v1/checklist-templates/${templateId}/versions/${versionId}/file`),

  listTeam: (teamId: string) =>
    apiClient.get<ChecklistTemplateListResponse>(`/api/v1/teams/${teamId}/checklist-templates`),

  uploadTeam: (teamId: string, payload: UploadChecklistTemplatePayload) =>
    apiFormDataRequest<ChecklistTemplateResponse>(
      `/api/v1/teams/${teamId}/checklist-templates`,
      toFormData(payload),
    ),

  activateTeam: (teamId: string, templateId: string, versionId: string) =>
    apiClient.patch<ChecklistTemplateResponse>(
      `/api/v1/teams/${teamId}/checklist-templates/${templateId}/versions/${versionId}/activate`,
      {},
    ),

  downloadTeam: (teamId: string, templateId: string, versionId: string) =>
    apiBlobRequest(`/api/v1/teams/${teamId}/checklist-templates/${templateId}/versions/${versionId}/file`),
};

export const projectChecklistsApi = {
  getLocal: (projectId: string) =>
    apiClient.get<ProjectChecklistResponse>(`/api/v1/personal-projects/${projectId}/checklist`),

  generateLocal: (projectId: string, payload: GenerateProjectChecklistRequest) =>
    apiClient.post<ProjectChecklistResponse>(`/api/v1/personal-projects/${projectId}/checklist/generate`, payload),

  updateLocalItem: (projectId: string, itemId: string, payload: UpdateProjectChecklistItemRequest) =>
    apiClient.patch<ProjectChecklistResponse>(`/api/v1/personal-projects/${projectId}/checklist/items/${itemId}`, payload),

  createLocalItem: (projectId: string, payload: CreateProjectChecklistItemRequest) =>
    apiClient.post<ProjectChecklistResponse>(`/api/v1/personal-projects/${projectId}/checklist/items`, payload),

  deleteLocalItem: (projectId: string, itemId: string) =>
    apiClient.delete<ProjectChecklistResponse>(`/api/v1/personal-projects/${projectId}/checklist/items/${itemId}`),

  exportLocal: (projectId: string) =>
    apiBlobRequest(`/api/v1/personal-projects/${projectId}/checklist/export`),

  getTeam: (teamId: string, projectId: string) =>
    apiClient.get<ProjectChecklistResponse>(`/api/v1/teams/${teamId}/projects/${projectId}/checklist`),

  generateTeam: (teamId: string, projectId: string, payload: GenerateProjectChecklistRequest) =>
    apiClient.post<ProjectChecklistResponse>(`/api/v1/teams/${teamId}/projects/${projectId}/checklist/generate`, payload),

  updateTeamItem: (teamId: string, projectId: string, itemId: string, payload: UpdateProjectChecklistItemRequest) =>
    apiClient.patch<ProjectChecklistResponse>(`/api/v1/teams/${teamId}/projects/${projectId}/checklist/items/${itemId}`, payload),

  createTeamItem: (teamId: string, projectId: string, payload: CreateProjectChecklistItemRequest) =>
    apiClient.post<ProjectChecklistResponse>(`/api/v1/teams/${teamId}/projects/${projectId}/checklist/items`, payload),

  deleteTeamItem: (teamId: string, projectId: string, itemId: string) =>
    apiClient.delete<ProjectChecklistResponse>(`/api/v1/teams/${teamId}/projects/${projectId}/checklist/items/${itemId}`),

  exportTeam: (teamId: string, projectId: string) =>
    apiBlobRequest(`/api/v1/teams/${teamId}/projects/${projectId}/checklist/export`),
};