import { getDb } from '../db/client.js';

import type { Tagging } from '@workspace/shared';

interface TaggingRow {
  id: string;
  tag_id: string;
  taggable_type: string;
  taggable_id: string;
  created_at: string;
}

const isTaggingRow = (value: unknown): value is TaggingRow => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.tag_id === 'string' &&
    typeof candidate.taggable_type === 'string' &&
    typeof candidate.taggable_id === 'string' &&
    typeof candidate.created_at === 'string'
  );
};

const mapRowToTagging = (row: TaggingRow): Tagging => ({
  id: row.id,
  tagId: row.tag_id,
  taggableType: row.taggable_type,
  taggableId: row.taggable_id,
  createdAt: row.created_at
});

export interface CreateTaggingData {
  id: string;
  tagId: string;
  taggableType: string;
  taggableId: string;
}

export const taggingsRepository = {
  /**
   * Create a new tagging (attach a tag to an entity)
   */
  async create(data: CreateTaggingData): Promise<Tagging> {
    const db = await getDb();

    db.prepare(
      `INSERT INTO taggings (id, tag_id, taggable_type, taggable_id)
       VALUES (?, ?, ?, ?)`
    ).run(data.id, data.tagId, data.taggableType, data.taggableId);

    const tagging = await this.getById(data.id);
    if (!tagging) throw new Error(`Failed to retrieve tagging after insert: ${data.id}`);
    return tagging;
  },

  /**
   * Get tagging by ID
   */
  async getById(id: string): Promise<Tagging | null> {
    const db = await getDb();
    const row = db.prepare('SELECT * FROM taggings WHERE id = ?').get(id);
    if (!isTaggingRow(row)) return null;
    return mapRowToTagging(row);
  },

  /**
   * Get all taggings for a specific entity
   */
  async getByTaggable(taggableType: string, taggableId: string): Promise<Tagging[]> {
    const db = await getDb();
    const rows = db
      .prepare('SELECT * FROM taggings WHERE taggable_type = ? AND taggable_id = ?')
      .all(taggableType, taggableId) as unknown[];
    return rows.filter(isTaggingRow).map(mapRowToTagging);
  },

  /**
   * Get all taggings for a specific tag
   */
  async getByTagId(tagId: string): Promise<Tagging[]> {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM taggings WHERE tag_id = ?').all(tagId) as unknown[];
    return rows.filter(isTaggingRow).map(mapRowToTagging);
  },

  /**
   * Delete a tagging by ID
   */
  async delete(id: string): Promise<boolean> {
    const db = await getDb();
    const result = db.prepare('DELETE FROM taggings WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /**
   * Delete all taggings for a specific entity
   */
  async deleteByTaggable(taggableType: string, taggableId: string): Promise<number> {
    const db = await getDb();
    const result = db
      .prepare('DELETE FROM taggings WHERE taggable_type = ? AND taggable_id = ?')
      .run(taggableType, taggableId);
    return result.changes;
  },

  /**
   * Check if a tag is attached to an entity
   */
  async exists(tagId: string, taggableType: string, taggableId: string): Promise<boolean> {
    const db = await getDb();
    const row = db
      .prepare(
        'SELECT 1 FROM taggings WHERE tag_id = ? AND taggable_type = ? AND taggable_id = ? LIMIT 1'
      )
      .get(tagId, taggableType, taggableId);
    return !!row;
  },

  /**
   * Get tag IDs for a specific entity
   */
  async getTagIds(taggableType: string, taggableId: string): Promise<string[]> {
    const db = await getDb();
    const rows = db
      .prepare('SELECT tag_id FROM taggings WHERE taggable_type = ? AND taggable_id = ?')
      .all(taggableType, taggableId) as unknown[];

    return rows
      .filter((row): row is { tag_id: string } => {
        return row !== null && typeof row === 'object' && typeof (row as Record<string, unknown>).tag_id === 'string';
      })
      .map((row) => row.tag_id);
  },

  /**
   * Sync tags for an entity (replace all existing tags with new ones)
   */
  async syncTags(
    taggableType: string,
    taggableId: string,
    tagIds: string[],
    generateId: () => string
  ): Promise<void> {
    const db = await getDb();

    // Delete existing taggings
    db.prepare('DELETE FROM taggings WHERE taggable_type = ? AND taggable_id = ?').run(
      taggableType,
      taggableId
    );

    // Insert new taggings
    const insertStmt = db.prepare(
      'INSERT INTO taggings (id, tag_id, taggable_type, taggable_id) VALUES (?, ?, ?, ?)'
    );

    for (const tagId of tagIds) {
      insertStmt.run(generateId(), tagId, taggableType, taggableId);
    }
  }
};
