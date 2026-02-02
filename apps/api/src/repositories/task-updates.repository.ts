import { getDb } from '../db/client.js';

import type { TaskUpdate, TaskUpdateEntityType } from '@workspace/shared';

interface TaskUpdateRow {
  id: string;
  entity_type: string;
  entity_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

const isTaskUpdateRow = (value: unknown): value is TaskUpdateRow => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.entity_type === 'string' &&
    typeof candidate.entity_id === 'string' &&
    typeof candidate.content === 'string' &&
    typeof candidate.created_at === 'string' &&
    typeof candidate.updated_at === 'string'
  );
};

const mapRowToTaskUpdate = (row: TaskUpdateRow, replies: TaskUpdate[] = []): TaskUpdate => ({
  id: row.id,
  entityType: row.entity_type as TaskUpdateEntityType,
  entityId: row.entity_id,
  parentId: row.parent_id ?? undefined,
  content: row.content,
  replies: replies.length > 0 ? replies : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export interface CreateTaskUpdateData {
  id: string;
  entityType: TaskUpdateEntityType;
  entityId: string;
  parentId?: string;
  content: string;
}

export interface UpdateTaskUpdateData {
  content: string;
}

export const taskUpdatesRepository = {
  /**
   * Create a new task update
   */
  async create(data: CreateTaskUpdateData): Promise<TaskUpdate> {
    const db = await getDb();

    db.prepare(`
      INSERT INTO task_updates (id, entity_type, entity_id, parent_id, content)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.id, data.entityType, data.entityId, data.parentId ?? null, data.content);

    const row: unknown = db.prepare('SELECT * FROM task_updates WHERE id = ?').get(data.id);

    if (!isTaskUpdateRow(row)) {
      throw new Error('Failed to create task update');
    }

    return mapRowToTaskUpdate(row);
  },

  /**
   * Get a task update by ID
   */
  async getById(id: string): Promise<TaskUpdate | null> {
    const db = await getDb();
    const row: unknown = db.prepare('SELECT * FROM task_updates WHERE id = ?').get(id);

    if (!isTaskUpdateRow(row)) {
      return null;
    }

    return mapRowToTaskUpdate(row);
  },

  /**
   * List task updates for an entity (top-level only, with nested replies)
   * Returns top-level updates (where parent_id IS NULL) with their replies nested
   */
  async listByEntity(entityType: TaskUpdateEntityType, entityId: string): Promise<TaskUpdate[]> {
    const db = await getDb();

    // Get all updates for the entity
    const allRows: unknown = db.prepare(`
      SELECT * FROM task_updates 
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at ASC
    `).all(entityType, entityId);

    if (!Array.isArray(allRows)) {
      return [];
    }

    const validRows = allRows.filter(isTaskUpdateRow);

    // Separate top-level updates from replies
    const topLevelRows = validRows.filter((r) => !r.parent_id);
    const replyRows = validRows.filter((r) => r.parent_id);

    // Group replies by parent_id
    const repliesByParentId = new Map<string, TaskUpdateRow[]>();
    for (const reply of replyRows) {
      if (!reply.parent_id) continue;
      const existing = repliesByParentId.get(reply.parent_id) ?? [];
      existing.push(reply);
      repliesByParentId.set(reply.parent_id, existing);
    }

    // Map top-level updates with their replies nested
    return topLevelRows.map((row) => {
      const replies = (repliesByParentId.get(row.id) ?? []).map((r) => mapRowToTaskUpdate(r));
      return mapRowToTaskUpdate(row, replies);
    });
  },

  /**
   * Update a task update
   */
  async update(id: string, data: UpdateTaskUpdateData): Promise<TaskUpdate | null> {
    const db = await getDb();

    const result = db.prepare(`
      UPDATE task_updates SET content = ? WHERE id = ?
    `).run(data.content, id);

    if (result.changes === 0) {
      return null;
    }

    const row: unknown = db.prepare('SELECT * FROM task_updates WHERE id = ?').get(id);

    if (!isTaskUpdateRow(row)) {
      return null;
    }

    return mapRowToTaskUpdate(row);
  },

  /**
   * Delete a task update
   */
  async delete(id: string): Promise<boolean> {
    const db = await getDb();
    const result = db.prepare('DELETE FROM task_updates WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /**
   * Delete all updates for an entity (used when deleting the parent entity)
   */
  async deleteByEntity(entityType: TaskUpdateEntityType, entityId: string): Promise<number> {
    const db = await getDb();
    const result = db.prepare(`
      DELETE FROM task_updates WHERE entity_type = ? AND entity_id = ?
    `).run(entityType, entityId);
    return result.changes;
  }
};
