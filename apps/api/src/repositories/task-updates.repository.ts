import { getDb } from '../db/client.js';

import type { TaskUpdate, TaskUpdateEntityType } from '@workspace/shared';

interface TaskUpdateRow {
  id: string;
  entity_type: string;
  entity_id: string;
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

const mapRowToTaskUpdate = (row: TaskUpdateRow): TaskUpdate => ({
  id: row.id,
  entityType: row.entity_type as TaskUpdateEntityType,
  entityId: row.entity_id,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export interface CreateTaskUpdateData {
  id: string;
  entityType: TaskUpdateEntityType;
  entityId: string;
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
      INSERT INTO task_updates (id, entity_type, entity_id, content)
      VALUES (?, ?, ?, ?)
    `).run(data.id, data.entityType, data.entityId, data.content);

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
   * List task updates for an entity (newest first)
   */
  async listByEntity(entityType: TaskUpdateEntityType, entityId: string): Promise<TaskUpdate[]> {
    const db = await getDb();
    const rows: unknown = db.prepare(`
      SELECT * FROM task_updates 
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
    `).all(entityType, entityId);

    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.filter(isTaskUpdateRow).map(mapRowToTaskUpdate);
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
