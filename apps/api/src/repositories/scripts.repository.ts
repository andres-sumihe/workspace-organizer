import { getDb } from '../db/client.js';

import type { BatchScript, BatchScriptDetail, DriveMapping, ScriptTag, ScriptType } from '@workspace/shared';

interface ScriptRow {
  id: string;
  name: string;
  description: string | null;
  content: string;
  type: ScriptType;
  is_active: number;
  has_credentials: number;
  tags: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface DriveMappingRow {
  id: string;
  script_id: string;
  drive_letter: string;
  network_path: string;
  server_name: string | null;
  has_credentials: number;
  username: string | null;
  created_at: string;
  updated_at: string;
}

interface TagRow {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

const isScriptRow = (value: unknown): value is ScriptRow => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.content === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.is_active === 'number' &&
    typeof candidate.has_credentials === 'number' &&
    typeof candidate.created_at === 'string' &&
    typeof candidate.updated_at === 'string'
  );
};

const isDriveMappingRow = (value: unknown): value is DriveMappingRow => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.script_id === 'string' &&
    typeof candidate.drive_letter === 'string' &&
    typeof candidate.network_path === 'string' &&
    typeof candidate.has_credentials === 'number' &&
    typeof candidate.created_at === 'string' &&
    typeof candidate.updated_at === 'string'
  );
};

const isTagRow = (value: unknown): value is TagRow => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.created_at === 'string' &&
    typeof candidate.updated_at === 'string'
  );
};

const mapRowToScript = (row: ScriptRow): BatchScript => {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    content: row.content,
    type: row.type,
    isActive: row.is_active === 1,
    hasCredentials: row.has_credentials === 1,
    createdBy: row.created_by ?? undefined,
    updatedBy: row.updated_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const mapRowToDriveMapping = (row: DriveMappingRow): DriveMapping => {
  return {
    id: row.id,
    scriptId: row.script_id,
    driveLetter: row.drive_letter,
    networkPath: row.network_path,
    serverName: row.server_name ?? undefined,
    hasCredentials: row.has_credentials === 1,
    username: row.username ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const mapRowToTag = (row: TagRow): ScriptTag => {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

export interface ListScriptsParams {
  limit: number;
  offset: number;
  type?: ScriptType;
  isActive?: boolean;
  driveLetter?: string;
  tagId?: string;
  searchQuery?: string;
}

export const listScripts = async (params: ListScriptsParams): Promise<BatchScript[]> => {
  const db = await getDb();
  const { limit, offset, type, isActive, driveLetter, tagId, searchQuery } = params;

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (type !== undefined) {
    conditions.push('s.type = ?');
    values.push(type);
  }

  if (isActive !== undefined) {
    conditions.push('s.is_active = ?');
    values.push(isActive ? 1 : 0);
  }

  if (driveLetter !== undefined) {
    conditions.push('EXISTS (SELECT 1 FROM drive_mappings dm WHERE dm.script_id = s.id AND dm.drive_letter = ?)');
    values.push(driveLetter);
  }

  if (tagId !== undefined) {
    conditions.push('EXISTS (SELECT 1 FROM script_tags st WHERE st.script_id = s.id AND st.tag_id = ?)');
    values.push(tagId);
  }

  if (searchQuery !== undefined && searchQuery.trim() !== '') {
    conditions.push('(s.name LIKE ? OR s.description LIKE ?)');
    const searchPattern = `%${searchQuery}%`;
    values.push(searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  values.push(limit, offset);

  const rowsRaw: unknown = db.prepare(
    `SELECT s.* FROM scripts s ${whereClause} ORDER BY s.name LIMIT ? OFFSET ?`
  ).all(...values);

  const scripts: BatchScript[] = [];

  if (Array.isArray(rowsRaw)) {
    for (const row of rowsRaw) {
      if (isScriptRow(row)) {
        scripts.push(mapRowToScript(row));
      }
    }
  }

  return scripts;
};

export const countScripts = async (params: Omit<ListScriptsParams, 'limit' | 'offset'>): Promise<number> => {
  const db = await getDb();
  const { type, isActive, driveLetter, tagId, searchQuery } = params;

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (type !== undefined) {
    conditions.push('s.type = ?');
    values.push(type);
  }

  if (isActive !== undefined) {
    conditions.push('s.is_active = ?');
    values.push(isActive ? 1 : 0);
  }

  if (driveLetter !== undefined) {
    conditions.push('EXISTS (SELECT 1 FROM drive_mappings dm WHERE dm.script_id = s.id AND dm.drive_letter = ?)');
    values.push(driveLetter);
  }

  if (tagId !== undefined) {
    conditions.push('EXISTS (SELECT 1 FROM script_tags st WHERE st.script_id = s.id AND st.tag_id = ?)');
    values.push(tagId);
  }

  if (searchQuery !== undefined && searchQuery.trim() !== '') {
    conditions.push('(s.name LIKE ? OR s.description LIKE ?)');
    const searchPattern = `%${searchQuery}%`;
    values.push(searchPattern, searchPattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result: unknown = db.prepare(`SELECT COUNT(1) as count FROM scripts s ${whereClause}`).get(...values);

  if (result && typeof result === 'object' && typeof (result as { count?: unknown }).count === 'number') {
    return (result as { count: number }).count;
  }

  return 0;
};

/**
 * Find scripts by matching filename pattern.
 * Matches against script name only (name-based matching).
 * Used for linking Control-M jobs to scripts via memName field.
 *
 * @param filename - The filename to search for (e.g., "SMART_INC.bat")
 * @returns Array of matching scripts
 */
export const findScriptsByFilename = async (filename: string): Promise<BatchScript[]> => {
  const db = await getDb();

  // Normalize the filename: remove extension and convert to uppercase for comparison
  const normalizedFilename = filename.replace(/\.[^.]+$/, '').toUpperCase();

  // Search by:
  // 1. Exact match on name (case-insensitive)
  // 2. Name matches filename without extension (case-insensitive)
  const rowsRaw: unknown = db.prepare(
    `SELECT * FROM scripts
     WHERE UPPER(name) = ?
        OR UPPER(name) = ?
     ORDER BY name`
  ).all(filename.toUpperCase(), normalizedFilename);

  const scripts: BatchScript[] = [];

  if (Array.isArray(rowsRaw)) {
    for (const row of rowsRaw) {
      if (isScriptRow(row)) {
        scripts.push(mapRowToScript(row));
      }
    }
  }

  return scripts;
};

/**
 * Find a single script by exact name match (case-insensitive).
 *
 * @param name - The script name to search for
 * @returns The matching script or null
 */
export const findScriptByName = async (name: string): Promise<BatchScript | null> => {
  const db = await getDb();

  const row: unknown = db.prepare('SELECT * FROM scripts WHERE UPPER(name) = ?').get(name.toUpperCase());

  if (!isScriptRow(row)) {
    return null;
  }

  return mapRowToScript(row);
};

export const findScriptById = async (id: string): Promise<BatchScriptDetail | null> => {
  const db = await getDb();
  const row: unknown = db.prepare('SELECT * FROM scripts WHERE id = ?').get(id);

  if (!isScriptRow(row)) {
    return null;
  }

  const script = mapRowToScript(row);

  // Fetch drive mappings
  const mappingsRaw: unknown = db.prepare('SELECT * FROM drive_mappings WHERE script_id = ?').all(id);
  const driveMappings: DriveMapping[] = [];

  if (Array.isArray(mappingsRaw)) {
    for (const mappingRow of mappingsRaw) {
      if (isDriveMappingRow(mappingRow)) {
        driveMappings.push(mapRowToDriveMapping(mappingRow));
      }
    }
  }

  // Fetch tags
  const tagsRaw: unknown = db.prepare(
    `SELECT t.* FROM tags t
     INNER JOIN script_tags st ON st.tag_id = t.id
     WHERE st.script_id = ?`
  ).all(id);
  const tags: ScriptTag[] = [];

  if (Array.isArray(tagsRaw)) {
    for (const tagRow of tagsRaw) {
      if (isTagRow(tagRow)) {
        tags.push(mapRowToTag(tagRow));
      }
    }
  }

  // Fetch dependencies (scripts this script depends on)
  const dependenciesRaw: unknown = db.prepare(
    `SELECT s.* FROM scripts s
     INNER JOIN script_dependencies sd ON sd.dependency_script_id = s.id
     WHERE sd.dependent_script_id = ?`
  ).all(id);
  const dependencies: BatchScript[] = [];

  if (Array.isArray(dependenciesRaw)) {
    for (const depRow of dependenciesRaw) {
      if (isScriptRow(depRow)) {
        dependencies.push(mapRowToScript(depRow));
      }
    }
  }

  // Fetch dependents (scripts that depend on this script)
  const dependentsRaw: unknown = db.prepare(
    `SELECT s.* FROM scripts s
     INNER JOIN script_dependencies sd ON sd.dependent_script_id = s.id
     WHERE sd.dependency_script_id = ?`
  ).all(id);
  const dependents: BatchScript[] = [];

  if (Array.isArray(dependentsRaw)) {
    for (const depRow of dependentsRaw) {
      if (isScriptRow(depRow)) {
        dependents.push(mapRowToScript(depRow));
      }
    }
  }

  return {
    ...script,
    driveMappings,
    tags,
    dependencies,
    dependents
  };
};

export interface CreateScriptInput {
  id: string;
  name: string;
  description?: string;
  content: string;
  type: ScriptType;
  isActive?: boolean;
  hasCredentials?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const createScript = async (input: CreateScriptInput): Promise<BatchScript> => {
  const db = await getDb();

  const {
    id,
    name,
    description,
    content,
    type,
    isActive = true,
    hasCredentials = false,
    createdBy,
    createdAt,
    updatedAt
  } = input;

  db.prepare(
    `INSERT INTO scripts (
      id, name, description, content, type, is_active, has_credentials,
      created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, description ?? null, content, type, isActive ? 1 : 0, hasCredentials ? 1 : 0, createdBy ?? null, createdBy ?? null, createdAt, updatedAt);

  const created = await findScriptById(id);

  if (!created) {
    throw new Error('Failed to create script');
  }

  return created;
};

export interface UpdateScriptInput {
  name?: string;
  description?: string;
  content?: string;
  type?: ScriptType;
  isActive?: boolean;
  hasCredentials?: boolean;
  updatedBy?: string;
}

export const updateScript = async (id: string, updates: UpdateScriptInput): Promise<BatchScript | null> => {
  const db = await getDb();
  const assignments: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    assignments.push('name = ?');
    values.push(updates.name);
  }

  if (updates.description !== undefined) {
    assignments.push('description = ?');
    values.push(updates.description ?? null);
  }

  if (updates.content !== undefined) {
    assignments.push('content = ?');
    values.push(updates.content);
  }

  if (updates.type !== undefined) {
    assignments.push('type = ?');
    values.push(updates.type);
  }

  if (updates.isActive !== undefined) {
    assignments.push('is_active = ?');
    values.push(updates.isActive ? 1 : 0);
  }

  if (updates.hasCredentials !== undefined) {
    assignments.push('has_credentials = ?');
    values.push(updates.hasCredentials ? 1 : 0);
  }

  if (updates.updatedBy !== undefined) {
    assignments.push('updated_by = ?');
    values.push(updates.updatedBy);
  }

  if (assignments.length === 0) {
    return findScriptById(id).then((detail) => (detail ? { ...detail } : null));
  }

  assignments.push('updated_at = ?');
  values.push(new Date().toISOString());

  values.push(id);

  db.prepare(`UPDATE scripts SET ${assignments.join(', ')} WHERE id = ?`).run(...values);

  const updated = await findScriptById(id);
  return updated ? { ...updated } : null;
};

export const deleteScript = async (id: string): Promise<void> => {
  const db = await getDb();
  db.prepare('DELETE FROM scripts WHERE id = ?').run(id);
};

// Drive Mappings
export interface CreateDriveMappingInput {
  id: string;
  scriptId: string;
  driveLetter: string;
  networkPath: string;
  serverName?: string;
  hasCredentials?: boolean;
  username?: string;
  createdAt: string;
  updatedAt: string;
}

export const createDriveMapping = async (input: CreateDriveMappingInput): Promise<DriveMapping> => {
  const db = await getDb();

  const {
    id,
    scriptId,
    driveLetter,
    networkPath,
    serverName,
    hasCredentials = false,
    username,
    createdAt,
    updatedAt
  } = input;

  db.prepare(
    `INSERT INTO drive_mappings (
      id, script_id, drive_letter, network_path, server_name,
      has_credentials, username, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    scriptId,
    driveLetter,
    networkPath,
    serverName ?? null,
    hasCredentials ? 1 : 0,
    username ?? null,
    createdAt,
    updatedAt
  );

  const rowRaw: unknown = db.prepare('SELECT * FROM drive_mappings WHERE id = ?').get(id);

  if (!isDriveMappingRow(rowRaw)) {
    throw new Error('Failed to create drive mapping');
  }

  return mapRowToDriveMapping(rowRaw);
};

export const deleteDriveMappingsByScriptId = async (scriptId: string): Promise<void> => {
  const db = await getDb();
  db.prepare('DELETE FROM drive_mappings WHERE script_id = ?').run(scriptId);
};

export const listAllDriveMappings = async (): Promise<DriveMapping[]> => {
  const db = await getDb();
  const rowsRaw: unknown = db.prepare('SELECT * FROM drive_mappings ORDER BY drive_letter').all();

  const mappings: DriveMapping[] = [];

  if (Array.isArray(rowsRaw)) {
    for (const row of rowsRaw) {
      if (isDriveMappingRow(row)) {
        mappings.push(mapRowToDriveMapping(row));
      }
    }
  }

  return mappings;
};

// Tags
export const findOrCreateTag = async (name: string, id: string, color?: string): Promise<ScriptTag> => {
  const db = await getDb();

  const existing: unknown = db.prepare('SELECT * FROM tags WHERE name = ?').get(name);

  if (isTagRow(existing)) {
    return mapRowToTag(existing);
  }

  const now = new Date().toISOString();

  db.prepare('INSERT INTO tags (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
    id,
    name,
    color ?? null,
    now,
    now
  );

  const created: unknown = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);

  if (!isTagRow(created)) {
    throw new Error('Failed to create tag');
  }

  return mapRowToTag(created);
};

export const attachTagToScript = async (scriptId: string, tagId: string): Promise<void> => {
  const db = await getDb();
  const now = new Date().toISOString();

  db.prepare('INSERT OR IGNORE INTO script_tags (script_id, tag_id, created_at) VALUES (?, ?, ?)').run(
    scriptId,
    tagId,
    now
  );
};

export const detachTagsFromScript = async (scriptId: string): Promise<void> => {
  const db = await getDb();
  db.prepare('DELETE FROM script_tags WHERE script_id = ?').run(scriptId);
};

export const listAllTags = async (): Promise<ScriptTag[]> => {
  const db = await getDb();
  const rowsRaw: unknown = db.prepare('SELECT * FROM tags ORDER BY name').all();

  const tags: ScriptTag[] = [];

  if (Array.isArray(rowsRaw)) {
    for (const row of rowsRaw) {
      if (isTagRow(row)) {
        tags.push(mapRowToTag(row));
      }
    }
  }

  return tags;
};
