import { taggingsRepository } from './taggings.repository.js';
import { tagsRepository } from './tags.repository.js';
import { getDb } from '../db/client.js';

import type { PersonalProject, PersonalProjectStatus, Tag } from '@workspace/shared';

interface ProjectRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  due_date: string | null;
  actual_end_date: string | null;
  business_proposal_id: string | null;
  change_id: string | null;
  notes: string | null;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
}

const isProjectRow = (value: unknown): value is ProjectRow => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.status === 'string' &&
    typeof candidate.created_at === 'string' &&
    typeof candidate.updated_at === 'string'
  );
};

const mapRowToProject = (row: ProjectRow, tags: Tag[]): PersonalProject => ({
  id: row.id,
  title: row.title,
  description: row.description ?? undefined,
  status: row.status as PersonalProjectStatus,
  startDate: row.start_date ?? undefined,
  dueDate: row.due_date ?? undefined,
  actualEndDate: row.actual_end_date ?? undefined,
  businessProposalId: row.business_proposal_id ?? undefined,
  changeId: row.change_id ?? undefined,
  notes: row.notes ?? undefined,
  workspaceId: row.workspace_id ?? undefined,
  tags,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export interface CreateProjectData {
  id: string;
  title: string;
  description?: string;
  status?: PersonalProjectStatus;
  startDate?: string;
  dueDate?: string;
  businessProposalId?: string;
  changeId?: string;
  notes?: string;
  workspaceId?: string;
}

export interface UpdateProjectData {
  title?: string;
  description?: string;
  status?: PersonalProjectStatus;
  startDate?: string;
  dueDate?: string;
  actualEndDate?: string;
  businessProposalId?: string;
  changeId?: string;
  notes?: string;
  workspaceId?: string;
}

export interface ListProjectsParams {
  workspaceId?: string;
  status?: PersonalProjectStatus[];
  tagIds?: string[];
}

const TAGGABLE_TYPE = 'personal_projects';

export const personalProjectsRepository = {
  /**
   * Create a new personal project
   */
  async create(data: CreateProjectData): Promise<PersonalProject> {
    const db = await getDb();

    db.prepare(
      `INSERT INTO personal_projects (
        id, title, description, status, start_date, due_date, 
        business_proposal_id, change_id, notes, workspace_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      data.id,
      data.title,
      data.description ?? null,
      data.status ?? 'active',
      data.startDate ?? null,
      data.dueDate ?? null,
      data.businessProposalId ?? null,
      data.changeId ?? null,
      data.notes ?? null,
      data.workspaceId ?? null
    );

    const created = await this.findById(data.id);
    if (!created) {
      throw new Error('Failed to create personal project');
    }
    return created;
  },

  /**
   * Find a project by ID
   */
  async findById(id: string): Promise<PersonalProject | null> {
    const db = await getDb();
    const row = db.prepare('SELECT * FROM personal_projects WHERE id = ?').get(id);

    if (!isProjectRow(row)) return null;

    const tags = await this.getTagsForProject(id);
    return mapRowToProject(row, tags);
  },

  /**
   * List projects with optional filters
   */
  async list(params: ListProjectsParams = {}): Promise<PersonalProject[]> {
    const db = await getDb();
    const conditions: string[] = [];
    const bindings: unknown[] = [];

    if (params.workspaceId) {
      conditions.push('workspace_id = ?');
      bindings.push(params.workspaceId);
    }

    if (params.status && params.status.length > 0) {
      const placeholders = params.status.map(() => '?').join(', ');
      conditions.push(`status IN (${placeholders})`);
      bindings.push(...params.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM personal_projects ${whereClause} ORDER BY created_at DESC`;

    const rows = db.prepare(query).all(...bindings);
    const projects: PersonalProject[] = [];

    for (const row of rows) {
      if (isProjectRow(row)) {
        const tags = await this.getTagsForProject(row.id);
        projects.push(mapRowToProject(row, tags));
      }
    }

    // Filter by tags if specified
    if (params.tagIds && params.tagIds.length > 0) {
      return projects.filter((project) =>
        params.tagIds!.some((tagId) => project.tags.some((t) => t.id === tagId))
      );
    }

    return projects;
  },

  /**
   * Update a project
   */
  async update(id: string, data: UpdateProjectData): Promise<PersonalProject | null> {
    const db = await getDb();
    const updates: string[] = [];
    const bindings: unknown[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      bindings.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      bindings.push(data.description || null);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      bindings.push(data.status);
    }
    if (data.startDate !== undefined) {
      updates.push('start_date = ?');
      bindings.push(data.startDate || null);
    }
    if (data.dueDate !== undefined) {
      updates.push('due_date = ?');
      bindings.push(data.dueDate || null);
    }
    if (data.actualEndDate !== undefined) {
      updates.push('actual_end_date = ?');
      bindings.push(data.actualEndDate || null);
    }
    if (data.businessProposalId !== undefined) {
      updates.push('business_proposal_id = ?');
      bindings.push(data.businessProposalId || null);
    }
    if (data.changeId !== undefined) {
      updates.push('change_id = ?');
      bindings.push(data.changeId || null);
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      bindings.push(data.notes || null);
    }
    if (data.workspaceId !== undefined) {
      updates.push('workspace_id = ?');
      bindings.push(data.workspaceId || null);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    bindings.push(id);
    db.prepare(`UPDATE personal_projects SET ${updates.join(', ')} WHERE id = ?`).run(...bindings);

    return this.findById(id);
  },

  /**
   * Delete a project
   */
  async delete(id: string): Promise<boolean> {
    const db = await getDb();

    // Remove all taggings first
    await taggingsRepository.deleteByTaggable(TAGGABLE_TYPE, id);

    const result = db.prepare('DELETE FROM personal_projects WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /**
   * Get tags for a project
   */
  async getTagsForProject(projectId: string): Promise<Tag[]> {
    const tagIds = await taggingsRepository.getTagIds(TAGGABLE_TYPE, projectId);
    if (tagIds.length === 0) return [];

    return tagsRepository.getByIds(tagIds);
  },

  /**
   * Set tags for a project
   */
  async setTags(projectId: string, tagIds: string[]): Promise<void> {
    await taggingsRepository.syncTags(TAGGABLE_TYPE, projectId, tagIds, () => {
      const { randomUUID } = require('crypto');
      return randomUUID();
    });
  },

  /**
   * Find project by title (for NLP matching)
   */
  async findByTitle(title: string): Promise<PersonalProject | null> {
    const db = await getDb();
    const row = db
      .prepare('SELECT * FROM personal_projects WHERE LOWER(title) = LOWER(?)')
      .get(title);

    if (!isProjectRow(row)) return null;

    const tags = await this.getTagsForProject(row.id);
    return mapRowToProject(row, tags);
  },

  /**
   * Search projects by title (partial match)
   */
  async search(query: string): Promise<PersonalProject[]> {
    const db = await getDb();
    const rows = db
      .prepare('SELECT * FROM personal_projects WHERE title LIKE ? ORDER BY title')
      .all(`%${query}%`);

    const projects: PersonalProject[] = [];
    for (const row of rows) {
      if (isProjectRow(row)) {
        const tags = await this.getTagsForProject(row.id);
        projects.push(mapRowToProject(row, tags));
      }
    }
    return projects;
  }
};
