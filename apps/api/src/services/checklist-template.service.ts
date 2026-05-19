import { createHash } from 'node:crypto';
import path from 'node:path';

import { checklistTemplatesRepository } from '../repositories/checklist-templates.repository.js';
import { checklistTemplatesPgRepository } from '../repositories/checklist-templates.repository.pg.js';

import type { ChecklistTemplateDetail, ChecklistTemplateSummary } from '@workspace/shared';
import type { ChecklistTemplateFileRecord, SaveChecklistTemplateInput } from '../repositories/checklist-templates.repository.js';

interface RegisterTemplateInput {
  templateId?: string;
  teamId?: string;
  name?: string;
  description?: string;
  versionLabel?: string;
  originalFilename: string;
  mimeType: string;
  buffer: Buffer;
  uploadedByEmail?: string;
  activate: boolean;
}

const allowedExtensions = new Set(['.xlsx', '.xlsm']);

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const templateNameFromFile = (filename: string): string => {
  const parsed = path.parse(filename);
  return parsed.name.trim() || 'Checklist Template';
};

const versionLabelFromFile = (filename: string): string => {
  const parsed = path.parse(filename);
  return `${parsed.name.trim() || 'template'}-${new Date().toISOString()}`;
};

const assertWorkbookFile = (filename: string, buffer: Buffer) => {
  const extension = path.extname(filename).toLowerCase();
  if (!allowedExtensions.has(extension)) {
    throw new Error('Only .xlsx or .xlsm checklist templates are allowed');
  }
  if (buffer.length === 0) {
    throw new Error('Checklist template file is empty');
  }
};

const buildSaveInput = (input: RegisterTemplateInput): SaveChecklistTemplateInput => {
  assertWorkbookFile(input.originalFilename, input.buffer);

  return {
    templateId: input.templateId,
    name: normalizeText(input.name) ?? templateNameFromFile(input.originalFilename),
    description: normalizeText(input.description),
    versionLabel: normalizeText(input.versionLabel) ?? versionLabelFromFile(input.originalFilename),
    originalFilename: input.originalFilename,
    mimeType: input.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: input.buffer.length,
    checksumSha256: createHash('sha256').update(input.buffer).digest('hex'),
    xlsxBuffer: input.buffer,
    mappingStatus: 'pending',
    uploadedByEmail: input.uploadedByEmail,
    activate: input.activate,
  };
};

export const checklistTemplateService = {
  async listLocal(): Promise<ChecklistTemplateSummary[]> {
    return checklistTemplatesRepository.list();
  },

  async getLocal(templateId: string): Promise<ChecklistTemplateDetail | null> {
    return checklistTemplatesRepository.getById(templateId);
  },

  async registerLocal(input: RegisterTemplateInput): Promise<ChecklistTemplateDetail> {
    return checklistTemplatesRepository.saveVersion(buildSaveInput(input));
  },

  async activateLocal(templateId: string, versionId: string, updatedByEmail?: string): Promise<ChecklistTemplateDetail | null> {
    return checklistTemplatesRepository.activateVersion(templateId, versionId, updatedByEmail);
  },

  async getLocalFile(templateId: string, versionId: string): Promise<ChecklistTemplateFileRecord | null> {
    return checklistTemplatesRepository.getVersionFile(templateId, versionId);
  },

  async listTeam(teamId: string): Promise<ChecklistTemplateSummary[]> {
    return checklistTemplatesPgRepository.list(teamId);
  },

  async getTeam(teamId: string, templateId: string): Promise<ChecklistTemplateDetail | null> {
    return checklistTemplatesPgRepository.getById(teamId, templateId);
  },

  async registerTeam(input: RegisterTemplateInput & { teamId: string }): Promise<ChecklistTemplateDetail> {
    return checklistTemplatesPgRepository.saveVersion(input.teamId, buildSaveInput(input));
  },

  async activateTeam(teamId: string, templateId: string, versionId: string, updatedByEmail?: string): Promise<ChecklistTemplateDetail | null> {
    return checklistTemplatesPgRepository.activateVersion(teamId, templateId, versionId, updatedByEmail);
  },

  async getTeamFile(teamId: string, templateId: string, versionId: string): Promise<ChecklistTemplateFileRecord | null> {
    return checklistTemplatesPgRepository.getVersionFile(teamId, templateId, versionId);
  },
};