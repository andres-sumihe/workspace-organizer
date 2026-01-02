import { getDb } from '../db/client.js';

interface SettingsRow {
  key: string;
  value_json: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const isSettingsRow = (value: unknown): value is SettingsRow => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.key === 'string' &&
    typeof candidate.value_json === 'string' &&
    typeof candidate.created_at === 'string' &&
    typeof candidate.updated_at === 'string'
  );
};

export interface Setting<T = unknown> {
  key: string;
  value: T;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

const mapRowToSetting = <T>(row: SettingsRow): Setting<T> => {
  let value: T;
  try {
    value = JSON.parse(row.value_json) as T;
  } catch {
    value = row.value_json as unknown as T;
  }
  
  return {
    key: row.key,
    value,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

export const settingsRepository = {
  /**
   * Get a single setting by key
   */
  async get<T = unknown>(key: string): Promise<Setting<T> | null> {
    const db = await getDb();
    const row = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
    if (!isSettingsRow(row)) return null;
    return mapRowToSetting<T>(row);
  },

  /**
   * Get multiple settings by key prefix
   */
  async getByPrefix<T = unknown>(prefix: string): Promise<Setting<T>[]> {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM settings WHERE key LIKE ?').all(`${prefix}%`) as unknown[];
    return rows.filter(isSettingsRow).map((row) => mapRowToSetting<T>(row));
  },

  /**
   * Get all settings
   */
  async getAll(): Promise<Setting[]> {
    const db = await getDb();
    const rows = db.prepare('SELECT * FROM settings ORDER BY key').all() as unknown[];
    return rows.filter(isSettingsRow).map((row) => mapRowToSetting(row));
  },

  /**
   * Set a setting value (upsert)
   */
  async set<T>(key: string, value: T, description?: string): Promise<Setting<T>> {
    const db = await getDb();
    const valueJson = JSON.stringify(value);
    
    db.prepare(
      `INSERT INTO settings (key, value_json, description)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value_json = excluded.value_json,
         description = COALESCE(excluded.description, settings.description)`
    ).run(key, valueJson, description ?? null);
    
    const result = await this.get<T>(key);
    if (!result) throw new Error(`Failed to retrieve setting after upsert: ${key}`);
    return result;
  },

  /**
   * Delete a setting by key
   */
  async delete(key: string): Promise<boolean> {
    const db = await getDb();
    const result = db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    return result.changes > 0;
  },

  /**
   * Delete settings by prefix
   */
  async deleteByPrefix(prefix: string): Promise<number> {
    const db = await getDb();
    const result = db.prepare('DELETE FROM settings WHERE key LIKE ?').run(`${prefix}%`);
    return result.changes;
  }
};
