import { randomUUID } from 'crypto';

import { personalProjectsRepository } from '../repositories/personal-projects.repository.js';

import type {
  PersonalProject,
  CreatePersonalProjectRequest,
  UpdatePersonalProjectRequest,
  PersonalProjectStatus
} from '@workspace/shared';

export interface ListProjectsOptions {
  workspaceId?: string;
  status?: PersonalProjectStatus[];
  tagIds?: string[];
}

export const personalProjectsService = {
  /**
   * Create a new personal project
   */
  async create(data: CreatePersonalProjectRequest): Promise<PersonalProject> {
    const id = randomUUID();

    const project = await personalProjectsRepository.create({
      id,
      title: data.title,
      description: data.description,
      status: data.status,
      startDate: data.startDate,
      dueDate: data.dueDate,
      businessProposalId: data.businessProposalId,
      changeId: data.changeId,
      notes: data.notes,
      workspaceId: data.workspaceId
    });

    // Set tags if provided
    if (data.tagIds && data.tagIds.length > 0) {
      await personalProjectsRepository.setTags(id, data.tagIds);
      return (await personalProjectsRepository.findById(id))!;
    }

    return project;
  },

  /**
   * Get a project by ID
   */
  async getById(id: string): Promise<PersonalProject | null> {
    return personalProjectsRepository.findById(id);
  },

  /**
   * List projects with optional filters
   */
  async list(options: ListProjectsOptions = {}): Promise<PersonalProject[]> {
    return personalProjectsRepository.list({
      workspaceId: options.workspaceId,
      status: options.status,
      tagIds: options.tagIds
    });
  },

  /**
   * Update a project
   */
  async update(id: string, data: UpdatePersonalProjectRequest): Promise<PersonalProject | null> {
    const { tagIds, ...updateData } = data;

    const project = await personalProjectsRepository.update(id, updateData);
    if (!project) return null;

    // Update tags if provided
    if (tagIds !== undefined) {
      await personalProjectsRepository.setTags(id, tagIds);
      return (await personalProjectsRepository.findById(id))!;
    }

    return project;
  },

  /**
   * Delete a project
   */
  async delete(id: string): Promise<boolean> {
    return personalProjectsRepository.delete(id);
  },

  /**
   * Find project by exact title (for NLP matching)
   */
  async findByTitle(title: string): Promise<PersonalProject | null> {
    return personalProjectsRepository.findByTitle(title);
  },

  /**
   * Search projects by title (partial match)
   */
  async search(query: string): Promise<PersonalProject[]> {
    return personalProjectsRepository.search(query);
  }
};
