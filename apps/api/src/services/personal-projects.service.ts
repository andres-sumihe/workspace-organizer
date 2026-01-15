import { randomUUID } from 'crypto';

import { personalProjectsRepository } from '../repositories/personal-projects.repository.js';
import { workLogsRepository } from '../repositories/work-logs.repository.js';
import { getDb } from '../db/client.js';

import type {
  PersonalProject,
  PersonalProjectDetail,
  PersonalProjectTaskStats,
  CreatePersonalProjectRequest,
  UpdatePersonalProjectRequest,
  PersonalProjectStatus,
  WorkspaceSummary
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
  },

  /**
   * Get detailed project information including linked tasks and workspace
   */
  async getDetail(id: string): Promise<PersonalProjectDetail | null> {
    const project = await personalProjectsRepository.findById(id);
    if (!project) return null;

    // Get linked work logs (tasks) for this project
    const linkedTasks = await workLogsRepository.list({ projectId: id });

    // Calculate task statistics
    const taskStats: PersonalProjectTaskStats = {
      total: linkedTasks.length,
      todo: linkedTasks.filter((t) => t.status === 'todo').length,
      inProgress: linkedTasks.filter((t) => t.status === 'in_progress').length,
      done: linkedTasks.filter((t) => t.status === 'done').length,
      blocked: linkedTasks.filter((t) => t.status === 'blocked').length
    };

    // Get linked workspace info if exists
    let linkedWorkspace: WorkspaceSummary | undefined;
    if (project.workspaceId) {
      const db = await getDb();
      const workspaceRow = db
        .prepare(
          `SELECT 
            w.id, w.name, w.root_path as rootPath, w.description,
            (SELECT COUNT(*) FROM projects WHERE workspace_id = w.id) as projectCount,
            (SELECT COUNT(*) FROM templates WHERE workspace_id = w.id) as templateCount
          FROM workspaces w WHERE w.id = ?`
        )
        .get(project.workspaceId) as {
          id: string;
          name: string;
          rootPath: string;
          description?: string;
          projectCount: number;
          templateCount: number;
        } | undefined;

      if (workspaceRow) {
        linkedWorkspace = {
          id: workspaceRow.id,
          name: workspaceRow.name,
          rootPath: workspaceRow.rootPath,
          status: 'healthy',
          projectCount: workspaceRow.projectCount ?? 0,
          templateCount: workspaceRow.templateCount ?? 0,
          lastIndexedAt: new Date().toISOString()
        };
      }
    }

    return {
      ...project,
      linkedTasks,
      taskStats,
      linkedWorkspace
    };
  }
};
