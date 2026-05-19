import { checklistTemplateService } from './checklist-template.service.js';
import { projectChecklistParserService } from './project-checklist-parser.service.js';
import { AppError } from '../errors/app-error.js';
import { projectChecklistsRepository } from '../repositories/project-checklists.repository.js';
import { projectChecklistsPgRepository } from '../repositories/project-checklists.repository.pg.js';

import type {
  ChecklistSectionDraft,
  CreateProjectChecklistItemInput,
  UpdateProjectChecklistItemInput,
} from '../repositories/project-checklists.repository.js';
import type { ChecklistTemplateSummary, ChecklistTemplateVersionSummary, ProjectChecklistDetail } from '@workspace/shared';

interface GenerateChecklistInput {
  projectId: string;
  templateId?: string;
  templateVersionId?: string;
  title?: string;
  overwrite?: boolean;
  createdByEmail?: string;
}

interface GenerateTeamChecklistInput extends GenerateChecklistInput {
  teamId: string;
}

interface ResolvedTemplateFile {
  templateId: string;
  version: ChecklistTemplateVersionSummary;
  buffer: Buffer;
}

interface ChecklistExportFile {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

const xlsxMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const normalizeText = (value: string | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const safeFilenamePart = (value: string): string => {
  const normalized = value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return normalized || 'project';
};

const findVersion = (
  template: ChecklistTemplateSummary,
  templateVersionId?: string,
): ChecklistTemplateVersionSummary | undefined => {
  if (!templateVersionId) return template.activeVersion;
  return template.activeVersion?.id === templateVersionId ? template.activeVersion : undefined;
};

const ensureSections = (sections: ChecklistSectionDraft[]) => {
  const itemCount = sections.reduce((count, section) => count + section.items.length, 0);
  if (itemCount === 0) {
    throw new AppError('Checklist template does not contain any readable rows', 400, 'CHECKLIST_TEMPLATE_EMPTY');
  }
};

const resolveLocalTemplateFile = async (templateId?: string, templateVersionId?: string): Promise<ResolvedTemplateFile> => {
  const templates = await checklistTemplateService.listLocal();
  const template = templateId
    ? templates.find((item) => item.id === templateId)
    : templates.find((item) => item.isActive && item.activeVersion);

  if (!template) {
    throw new AppError('Checklist template is not configured', 400, 'CHECKLIST_TEMPLATE_NOT_CONFIGURED');
  }

  const version = findVersion(template, templateVersionId);
  if (!version) {
    throw new AppError('Checklist template version is not available', 404, 'CHECKLIST_TEMPLATE_VERSION_NOT_FOUND');
  }

  const file = await checklistTemplateService.getLocalFile(template.id, version.id);
  if (!file) {
    throw new AppError('Checklist template file is not available', 404, 'CHECKLIST_TEMPLATE_VERSION_NOT_FOUND');
  }

  return { templateId: template.id, version, buffer: file.xlsxBuffer };
};

const resolveTeamTemplateFile = async (
  teamId: string,
  templateId?: string,
  templateVersionId?: string,
): Promise<ResolvedTemplateFile> => {
  const templates = await checklistTemplateService.listTeam(teamId);
  const template = templateId
    ? templates.find((item) => item.id === templateId)
    : templates.find((item) => item.isActive && item.activeVersion);

  if (!template) {
    throw new AppError('Checklist template is not configured', 400, 'CHECKLIST_TEMPLATE_NOT_CONFIGURED');
  }

  const version = findVersion(template, templateVersionId);
  if (!version) {
    throw new AppError('Checklist template version is not available', 404, 'CHECKLIST_TEMPLATE_VERSION_NOT_FOUND');
  }

  const file = await checklistTemplateService.getTeamFile(teamId, template.id, version.id);
  if (!file) {
    throw new AppError('Checklist template file is not available', 404, 'CHECKLIST_TEMPLATE_VERSION_NOT_FOUND');
  }

  return { templateId: template.id, version, buffer: file.xlsxBuffer };
};

const buildExportFile = async (
  templateBuffer: Buffer,
  checklist: ProjectChecklistDetail,
  projectTitle: string,
): Promise<ChecklistExportFile> => {
  const buffer = await projectChecklistParserService.writeChecklistWorkbook(templateBuffer, checklist);

  return {
    filename: `${safeFilenamePart(projectTitle)}-checklist.xlsx`,
    mimeType: xlsxMimeType,
    buffer,
  };
};

export const projectChecklistService = {
  async getLocal(projectId: string): Promise<ProjectChecklistDetail | null> {
    return projectChecklistsRepository.getByProjectId(projectId);
  },

  async generateLocal(input: GenerateChecklistInput): Promise<ProjectChecklistDetail> {
    const projectTitle = await projectChecklistsRepository.getProjectTitle(input.projectId);
    if (!projectTitle) {
      throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    }

    const existing = await projectChecklistsRepository.getByProjectId(input.projectId);
    if (existing && !input.overwrite) return existing;

    const templateFile = await resolveLocalTemplateFile(input.templateId, input.templateVersionId);
    const sections = await projectChecklistParserService.parseWorkbook(templateFile.buffer);
    ensureSections(sections);

    return projectChecklistsRepository.saveGenerated({
      projectId: input.projectId,
      templateId: templateFile.templateId,
      templateVersionId: templateFile.version.id,
      title: normalizeText(input.title) ?? `${projectTitle} Checklist`,
      sections,
      createdByEmail: input.createdByEmail,
      overwrite: Boolean(input.overwrite),
    });
  },

  async updateLocalItem(projectId: string, itemId: string, input: UpdateProjectChecklistItemInput): Promise<ProjectChecklistDetail | null> {
    return projectChecklistsRepository.updateItem(projectId, itemId, input);
  },

  async createLocalItem(projectId: string, input: CreateProjectChecklistItemInput): Promise<ProjectChecklistDetail | null> {
    return projectChecklistsRepository.createItem(projectId, input);
  },

  async deleteLocalItem(projectId: string, itemId: string, updatedByEmail?: string): Promise<ProjectChecklistDetail | null> {
    return projectChecklistsRepository.deleteItem(projectId, itemId, updatedByEmail);
  },

  async exportLocal(projectId: string): Promise<ChecklistExportFile> {
    const [projectTitle, checklist] = await Promise.all([
      projectChecklistsRepository.getProjectTitle(projectId),
      projectChecklistsRepository.getByProjectId(projectId),
    ]);

    if (!projectTitle) throw new AppError('Project not found', 404, 'PROJECT_NOT_FOUND');
    if (!checklist) throw new AppError('Checklist has not been generated', 404, 'PROJECT_CHECKLIST_NOT_FOUND');

    const file = await checklistTemplateService.getLocalFile(checklist.templateId, checklist.templateVersionId);
    if (!file) throw new AppError('Checklist template file is not available', 404, 'CHECKLIST_TEMPLATE_VERSION_NOT_FOUND');

    return buildExportFile(file.xlsxBuffer, checklist, projectTitle);
  },

  async getTeam(teamId: string, projectId: string): Promise<ProjectChecklistDetail | null> {
    return projectChecklistsPgRepository.getByProjectId(teamId, projectId);
  },

  async generateTeam(input: GenerateTeamChecklistInput): Promise<ProjectChecklistDetail> {
    const projectTitle = await projectChecklistsPgRepository.getProjectTitle(input.teamId, input.projectId);
    if (!projectTitle) {
      throw new AppError('Team project not found', 404, 'TEAM_PROJECT_NOT_FOUND');
    }

    const existing = await projectChecklistsPgRepository.getByProjectId(input.teamId, input.projectId);
    if (existing && !input.overwrite) return existing;

    const templateFile = await resolveTeamTemplateFile(input.teamId, input.templateId, input.templateVersionId);
    const sections = await projectChecklistParserService.parseWorkbook(templateFile.buffer);
    ensureSections(sections);

    return projectChecklistsPgRepository.saveGenerated(input.teamId, {
      projectId: input.projectId,
      templateId: templateFile.templateId,
      templateVersionId: templateFile.version.id,
      title: normalizeText(input.title) ?? `${projectTitle} Checklist`,
      sections,
      createdByEmail: input.createdByEmail,
      overwrite: Boolean(input.overwrite),
    });
  },

  async updateTeamItem(teamId: string, projectId: string, itemId: string, input: UpdateProjectChecklistItemInput): Promise<ProjectChecklistDetail | null> {
    return projectChecklistsPgRepository.updateItem(teamId, projectId, itemId, input);
  },

  async createTeamItem(teamId: string, projectId: string, input: CreateProjectChecklistItemInput): Promise<ProjectChecklistDetail | null> {
    return projectChecklistsPgRepository.createItem(teamId, projectId, input);
  },

  async deleteTeamItem(teamId: string, projectId: string, itemId: string, updatedByEmail?: string): Promise<ProjectChecklistDetail | null> {
    return projectChecklistsPgRepository.deleteItem(teamId, projectId, itemId, updatedByEmail);
  },

  async exportTeam(teamId: string, projectId: string): Promise<ChecklistExportFile> {
    const [projectTitle, checklist] = await Promise.all([
      projectChecklistsPgRepository.getProjectTitle(teamId, projectId),
      projectChecklistsPgRepository.getByProjectId(teamId, projectId),
    ]);

    if (!projectTitle) throw new AppError('Team project not found', 404, 'TEAM_PROJECT_NOT_FOUND');
    if (!checklist) throw new AppError('Checklist has not been generated', 404, 'PROJECT_CHECKLIST_NOT_FOUND');

    const file = await checklistTemplateService.getTeamFile(teamId, checklist.templateId, checklist.templateVersionId);
    if (!file) throw new AppError('Checklist template file is not available', 404, 'CHECKLIST_TEMPLATE_VERSION_NOT_FOUND');

    return buildExportFile(file.xlsxBuffer, checklist, projectTitle);
  },
};