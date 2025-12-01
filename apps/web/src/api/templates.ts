import { apiClient } from './client';

import type {
  CreateTemplateInput,
  TemplateDetailResponse,
  TemplateListResponse,
  TemplateSummaryV2,
  UpdateTemplateInput
} from '@workspace/shared';


export async function fetchTemplateList(signal?: AbortSignal): Promise<TemplateSummaryV2[]> {
  const response = await apiClient.get<TemplateListResponse>('/api/v1/templates', { signal });
  return response.items;
}

export async function fetchTemplateDetail(templateId: string, signal?: AbortSignal) {
  const response = await apiClient.get<TemplateDetailResponse>(`/api/v1/templates/${templateId}`, { signal });
  return response.template;
}

export async function createTemplate(input: CreateTemplateInput, signal?: AbortSignal) {
  const response = await apiClient.post<TemplateDetailResponse>('/api/v1/templates', input, { signal });
  return response.template;
}

export async function updateTemplate(
  templateId: string,
  input: UpdateTemplateInput,
  signal?: AbortSignal
) {
  const response = await apiClient.patch<TemplateDetailResponse>(
    `/api/v1/templates/${templateId}`,
    input,
    { signal }
  );
  return response.template;
}

export async function deleteTemplate(templateId: string, signal?: AbortSignal) {
  await apiClient.delete(`/api/v1/templates/${templateId}`, { signal });
}

export async function fetchWorkspaceTemplates(workspaceId: string, signal?: AbortSignal): Promise<TemplateSummaryV2[]> {
  const response = await apiClient.get<TemplateListResponse>(`/api/v1/workspaces/${workspaceId}/templates`, {
    signal
  });
  return response.items;
}

export async function assignTemplateToWorkspace(
  workspaceId: string,
  templateId: string,
  signal?: AbortSignal
) {
  await apiClient.post(`/api/v1/workspaces/${workspaceId}/templates/${templateId}`, {}, { signal });
}

export async function unassignTemplateFromWorkspace(
  workspaceId: string,
  templateId: string,
  signal?: AbortSignal
) {
  await apiClient.delete(`/api/v1/workspaces/${workspaceId}/templates/${templateId}`, { signal });
}
