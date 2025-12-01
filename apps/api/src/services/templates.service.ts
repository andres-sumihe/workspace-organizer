
import { AppError } from '../errors/app-error.js';
import { TemplatesRepository } from '../repositories/templates.repository.js';

import type { AppDatabase } from '../db/client.js';
import type { CreateTemplateInput, TemplateSummaryV2, TemplateManifestV2, UpdateTemplateInput } from '@workspace/shared';

export class TemplatesService {
  private repository: TemplatesRepository;

  constructor(db: AppDatabase) {
    this.repository = new TemplatesRepository(db);
  }

  async listTemplates(): Promise<TemplateSummaryV2[]> {
    return this.repository.findAll();
  }

  async getTemplateById(id: string): Promise<TemplateManifestV2> {
    const template = await this.repository.findById(id);
    if (!template) {
      throw new AppError(`Template with ID ${id} not found`, 404, 'NOT_FOUND');
    }
    return template;
  }

  async createTemplate(input: CreateTemplateInput): Promise<TemplateManifestV2> {
    // Validate input
    if (!input.name.trim()) {
      throw new AppError('Template name is required', 400, 'VALIDATION_ERROR');
    }

    return this.repository.create(input);
  }

  async updateTemplate(id: string, input: UpdateTemplateInput): Promise<TemplateManifestV2> {
    const updated = await this.repository.update(id, input);
    if (!updated) {
      throw new AppError(`Template with ID ${id} not found`, 404, 'NOT_FOUND');
    }
    return updated;
  }

  async deleteTemplate(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new AppError(`Template with ID ${id} not found`, 404, 'NOT_FOUND');
    }
  }

  async assignTemplateToWorkspace(workspaceId: string, templateId: string): Promise<void> {
    // Verify template exists
    await this.getTemplateById(templateId);

    await this.repository.assignToWorkspace(workspaceId, templateId);
  }

  async unassignTemplateFromWorkspace(workspaceId: string, templateId: string): Promise<void> {
    await this.repository.unassignFromWorkspace(workspaceId, templateId);
  }

  async listWorkspaceTemplates(workspaceId: string): Promise<TemplateSummaryV2[]> {
    return this.repository.findWorkspaceTemplates(workspaceId);
  }
}
