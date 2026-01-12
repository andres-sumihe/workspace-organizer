import { getDb } from '../db/client.js';

import type { Tag } from '@workspace/shared';

interface TagRow {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

const isTagRow = (value: unknown): value is TagRow => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.created_at === 'string' &&
    typeof candidate.updated_at === 'string'
  );
};

const mapRowToTag = (row: TagRow): Tag => ({
  id: row.id,
  name: row.name,
  color: row.color ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export interface CreateTagData {
  id: string;
  name: string;
  color?: string;
}

export interface UpdateTagData {
  name?: string;
  color?: string;
}

export const tagsRepository = {
  /**
   * Create a new tag
   */
  async create(data: CreateTagData): Promise<Tag> {
    const db = await getDb();

    db.prepare(
      `INSERT INTO tags (id, name, color)
       VALUES (?, ?, ?)`
    ).run(data.id, data.name, data.color ?? null);

    const tag = await this.getById(data.id);
    if (!tag) throw new Error(`Failed to retrieve tag after insert: ${data.id}`);
    return tag;
  },

  /**
   * Get tag by ID
   */
  async getById(id: string): Promise<Tag | null> {
    const db = await getDb();
    const row = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
    if (!isTagRow(row)) return null;
    return mapRowToTag(row);
  },

  /**
   * Get tag by name
   */
  async getByName(name: string): Promise<Tag | null> {
    const db = await getDb();
    const row = db.prepare('SELECT * FROM tags WHERE name = ? COLLATE NOCASE').get(name);
    if (!isTagRow(row)) return null;
    return mapRowToTag(row);
  },

  /**
   * List all tags ordered by name
   */
  async list(): Promise<Tag[]> {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM tags ORDER BY name ASC').all() as unknown[];
    return rows.filter(isTagRow).map(mapRowToTag);
  },

  /**
   * Update a tag by ID
   */
  async update(id: string, data: UpdateTagData): Promise<Tag | null> {
    const db = await getDb();

    const updates: string[] = [];
    const params: (string | null)[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      params.push(data.color || null);
    }

    if (updates.length === 0) {
      return this.getById(id);
    }

    params.push(id);
    db.prepare(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    return this.getById(id);
  },

  /**
   * Delete a tag by ID
   * Returns true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    const db = await getDb();
    const result = db.prepare('DELETE FROM tags WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /**
   * Get tags by IDs
   */
  async getByIds(ids: string[]): Promise<Tag[]> {
    if (ids.length === 0) return [];
    const db = await getDb();
    const placeholders = ids.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT * FROM tags WHERE id IN (${placeholders}) ORDER BY name ASC`)
      .all(...ids) as unknown[];
    return rows.filter(isTagRow).map(mapRowToTag);
  },

  /**
   * Search tags by name prefix (for autocomplete)
   */
  async searchByName(query: string, limit = 10): Promise<Tag[]> {
    const db = await getDb();
    const rows = db
      .prepare('SELECT * FROM tags WHERE name LIKE ? COLLATE NOCASE ORDER BY name ASC LIMIT ?')
      .all(`${query}%`, limit) as unknown[];
    return rows.filter(isTagRow).map(mapRowToTag);
  }
};
