import { taggingsRepository } from './taggings.repository.js';
import { tagsRepository } from './tags.repository.js';
import { getDb } from '../db/client.js';

import type { WorkLogEntry, WorkLogStatus, WorkLogPriority, Tag, PersonalProjectSummary } from '@workspace/shared';

interface WorkLogRow {
  id: string;
  date: string;
  content: string;
  status: string;
  priority: string | null;
  start_date: string | null;
  due_date: string | null;
  actual_end_date: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectRow {
  id: string;
  title: string;
  status: string;
}

const isWorkLogRow = (value: unknown): value is WorkLogRow => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.date === 'string' &&
    typeof candidate.content === 'string' &&
    typeof candidate.status === 'string' &&
    typeof candidate.created_at === 'string' &&
    typeof candidate.updated_at === 'string'
  );
};

const isProjectRow = (value: unknown): value is ProjectRow => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.status === 'string'
  );
};

const mapRowToEntry = (row: WorkLogRow, tags: Tag[], project?: PersonalProjectSummary): WorkLogEntry => ({
  id: row.id,
  date: row.date,
  content: row.content,
  status: row.status as WorkLogStatus,
  priority: row.priority as WorkLogPriority | undefined,
  startDate: row.start_date ?? undefined,
  dueDate: row.due_date ?? undefined,
  actualEndDate: row.actual_end_date ?? undefined,
  projectId: row.project_id ?? undefined,
  project,
  tags,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export interface CreateWorkLogData {
  id: string;
  date: string;
  content: string;
  status?: WorkLogStatus;
  priority?: WorkLogPriority;
  startDate?: string;
  dueDate?: string;
  projectId?: string;
}

export interface UpdateWorkLogData {
  date?: string;
  content?: string;
  status?: WorkLogStatus;
  priority?: WorkLogPriority;
  startDate?: string;
  dueDate?: string;
  actualEndDate?: string;
  projectId?: string;
}

export interface ListWorkLogsParams {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  projectId?: string;
  tagIds?: string[];
  status?: WorkLogStatus[];
}

const TAGGABLE_TYPE = 'work_logs';

export const workLogsRepository = {
  /**
   * Create a new work log entry
   */
  async create(data: CreateWorkLogData): Promise<WorkLogEntry> {
    const db = await getDb();

    db.prepare(
      `INSERT INTO work_logs (id, date, content, status, priority, start_date, due_date, project_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      data.id,
      data.date,
      data.content,
      data.status ?? 'todo',
      data.priority ?? null,
      data.startDate ?? null,
      data.dueDate ?? null,
      data.projectId ?? null
    );

    const entry = await this.getById(data.id);
    if (!entry) throw new Error(`Failed to retrieve work log after insert: ${data.id}`);
    return entry;
  },

  /**
   * Get work log entry by ID with tags and project
   */
  async getById(id: string): Promise<WorkLogEntry | null> {
    const db = await getDb();
    const row = db.prepare('SELECT * FROM work_logs WHERE id = ?').get(id);
    if (!isWorkLogRow(row)) return null;

    const tagIds = await taggingsRepository.getTagIds(TAGGABLE_TYPE, id);
    const tags = await tagsRepository.getByIds(tagIds);
    
    // Resolve project if present
    let project: PersonalProjectSummary | undefined;
    if (row.project_id) {
      project = await this.getProjectSummary(row.project_id);
    }

    return mapRowToEntry(row, tags, project);
  },
  
  /**
   * Get project summary for embedding in work log
   */
  async getProjectSummary(projectId: string): Promise<PersonalProjectSummary | undefined> {
    const db = await getDb();
    const row = db.prepare('SELECT id, title, status FROM personal_projects WHERE id = ?').get(projectId);
    if (!isProjectRow(row)) return undefined;
    return {
      id: row.id,
      title: row.title,
      status: row.status as PersonalProjectSummary['status']
    };
  },

  /**
   * List work logs with optional filters
   * Returns entries ordered by date descending, then by created_at descending
   */
  async list(params: ListWorkLogsParams = {}): Promise<WorkLogEntry[]> {
    const db = await getDb();
    const conditions: string[] = [];
    const queryParams: (string | number)[] = [];

    if (params.from) {
      conditions.push('date >= ?');
      queryParams.push(params.from);
    }

    if (params.to) {
      conditions.push('date <= ?');
      queryParams.push(params.to);
    }

    if (params.projectId) {
      conditions.push('project_id = ?');
      queryParams.push(params.projectId);
    }

    if (params.status && params.status.length > 0) {
      const placeholders = params.status.map(() => '?').join(',');
      conditions.push(`status IN (${placeholders})`);
      queryParams.push(...params.status);
    }

    // Tag filtering is done post-query for simplicity (polymorphic relation)
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM work_logs ${whereClause} ORDER BY date DESC, created_at DESC`;

    const rows = db.prepare(query).all(...queryParams) as unknown[];
    const validRows = rows.filter(isWorkLogRow);

    // Resolve tags and project for each entry
    const entries: WorkLogEntry[] = [];
    for (const row of validRows) {
      const tagIds = await taggingsRepository.getTagIds(TAGGABLE_TYPE, row.id);
      const tags = await tagsRepository.getByIds(tagIds);

      // If tagIds filter is provided, check if entry has any of the requested tags
      if (params.tagIds && params.tagIds.length > 0) {
        const hasMatchingTag = tagIds.some((tid) => params.tagIds!.includes(tid));
        if (!hasMatchingTag) continue;
      }
      
      // Resolve project if present
      let project: PersonalProjectSummary | undefined;
      if (row.project_id) {
        project = await this.getProjectSummary(row.project_id);
      }

      entries.push(mapRowToEntry(row, tags, project));
    }

    return entries;
  },

  /**
   * Update a work log entry by ID
   */
  async update(id: string, data: UpdateWorkLogData): Promise<WorkLogEntry | null> {
    const db = await getDb();

    const updates: string[] = [];
    const params: (string | null)[] = [];

    if (data.date !== undefined) {
      updates.push('date = ?');
      params.push(data.date);
    }
    if (data.content !== undefined) {
      updates.push('content = ?');
      params.push(data.content);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.priority !== undefined) {
      updates.push('priority = ?');
      params.push(data.priority || null);
    }
    if (data.startDate !== undefined) {
      updates.push('start_date = ?');
      params.push(data.startDate || null);
    }
    if (data.dueDate !== undefined) {
      updates.push('due_date = ?');
      params.push(data.dueDate || null);
    }
    if (data.actualEndDate !== undefined) {
      updates.push('actual_end_date = ?');
      params.push(data.actualEndDate || null);
    }
    if (data.projectId !== undefined) {
      updates.push('project_id = ?');
      params.push(data.projectId || null);
    }

    if (updates.length === 0) {
      return this.getById(id);
    }

    params.push(id);
    db.prepare(`UPDATE work_logs SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    return this.getById(id);
  },

  /**
   * Delete a work log entry by ID
   * Also deletes associated taggings
   */
  async delete(id: string): Promise<boolean> {
    const db = await getDb();

    // Delete taggings first
    await taggingsRepository.deleteByTaggable(TAGGABLE_TYPE, id);

    const result = db.prepare('DELETE FROM work_logs WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /**
   * Get unfinished work logs from a specific date (for rollover)
   */
  async getUnfinishedByDate(date: string): Promise<WorkLogEntry[]> {
    const db = await getDb();
    // Filter out finished tasks including variations
    const rows = db
      .prepare(
        `SELECT * FROM work_logs 
         WHERE date = ? 
         AND status NOT IN ('done', 'blocked', 'completed', 'Completed', 'Done')
         ORDER BY created_at ASC`
      )
      .all(date) as unknown[];

    const validRows = rows.filter(isWorkLogRow);
    const entries: WorkLogEntry[] = [];

    for (const row of validRows) {
      const tagIds = await taggingsRepository.getTagIds(TAGGABLE_TYPE, row.id);
      const tags = await tagsRepository.getByIds(tagIds);
      entries.push(mapRowToEntry(row, tags));
    }

    return entries;
  },

  /**
   * Bulk update date for work logs (for move rollover)
   */
  async bulkUpdateDate(ids: string[], newDate: string): Promise<number> {
    if (ids.length === 0) return 0;
    const db = await getDb();
    const placeholders = ids.map(() => '?').join(',');
    const result = db
      .prepare(`UPDATE work_logs SET date = ? WHERE id IN (${placeholders})`)
      .run(newDate, ...ids);
    return result.changes;
  },

  /**
   * Get tag IDs for a work log
   */
  async getTagIds(workLogId: string): Promise<string[]> {
    return taggingsRepository.getTagIds(TAGGABLE_TYPE, workLogId);
  },

  /**
   * Sync tags for a work log
   */
  async syncTags(workLogId: string, tagIds: string[], generateId: () => string): Promise<void> {
    return taggingsRepository.syncTags(TAGGABLE_TYPE, workLogId, tagIds, generateId);
  }
};
