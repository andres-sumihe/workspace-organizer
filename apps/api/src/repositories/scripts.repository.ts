import { getDb } from '../db/client.js';

import type { BatchScript, BatchScriptDetail, DriveMapping, ScriptTag, ScriptType } from '@workspace/shared';

interface ScriptRow {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  content: string;
  type: ScriptType;
  is_active: number;
  has_credentials: number;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DriveMappingRow {
  id: string;
  script_id: string;
  drive_letter: string;
  network_path: string;
  server_name: string | null;
  share_name: string | null;
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
    typeof candidate.file_path === 'string' &&
    typeof candidate.content === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.is_active === 'number' &&
    typeof candidate.has_credentials === 'number' &&
    typeof candidate.execution_count === 'number' &&
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
    filePath: row.file_path,
    content: row.content,
    type: row.type,
    isActive: row.is_active === 1,
    hasCredentials: row.has_credentials === 1,
    executionCount: row.execution_count,
    lastExecutedAt: row.last_executed_at ?? undefined,
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
    shareName: row.share_name ?? undefined,
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
}

export const listScripts = async (params: ListScriptsParams): Promise<BatchScript[]> => {
  const db = await getDb();
  const { limit, offset, type, isActive, driveLetter, tagId } = params;

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

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  values.push(limit, offset);

  const rowsRaw: unknown = await db.all(
    `SELECT s.* FROM scripts s ${whereClause} ORDER BY s.name LIMIT ? OFFSET ?`,
    values
  );

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
  const { type, isActive, driveLetter, tagId } = params;

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

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result: unknown = await db.get(`SELECT COUNT(1) as count FROM scripts s ${whereClause}`, values);

  if (result && typeof result === 'object' && typeof (result as { count?: unknown }).count === 'number') {
    return (result as { count: number }).count;
  }

  return 0;
};

export const findScriptById = async (id: string): Promise<BatchScriptDetail | null> => {
  const db = await getDb();
  const row: unknown = await db.get('SELECT * FROM scripts WHERE id = ?', [id]);

  if (!isScriptRow(row)) {
    return null;
  }

  const script = mapRowToScript(row);

  // Fetch drive mappings
  const mappingsRaw: unknown = await db.all('SELECT * FROM drive_mappings WHERE script_id = ?', [id]);
  const driveMappings: DriveMapping[] = [];

  if (Array.isArray(mappingsRaw)) {
    for (const mappingRow of mappingsRaw) {
      if (isDriveMappingRow(mappingRow)) {
        driveMappings.push(mapRowToDriveMapping(mappingRow));
      }
    }
  }

  // Fetch tags
  const tagsRaw: unknown = await db.all(
    `SELECT t.* FROM tags t
     INNER JOIN script_tags st ON st.tag_id = t.id
     WHERE st.script_id = ?`,
    [id]
  );
  const tags: ScriptTag[] = [];

  if (Array.isArray(tagsRaw)) {
    for (const tagRow of tagsRaw) {
      if (isTagRow(tagRow)) {
        tags.push(mapRowToTag(tagRow));
      }
    }
  }

  // Fetch dependencies (scripts this script depends on)
  const dependenciesRaw: unknown = await db.all(
    `SELECT s.* FROM scripts s
     INNER JOIN script_dependencies sd ON sd.dependency_script_id = s.id
     WHERE sd.dependent_script_id = ?`,
    [id]
  );
  const dependencies: BatchScript[] = [];

  if (Array.isArray(dependenciesRaw)) {
    for (const depRow of dependenciesRaw) {
      if (isScriptRow(depRow)) {
        dependencies.push(mapRowToScript(depRow));
      }
    }
  }

  // Fetch dependents (scripts that depend on this script)
  const dependentsRaw: unknown = await db.all(
    `SELECT s.* FROM scripts s
     INNER JOIN script_dependencies sd ON sd.dependent_script_id = s.id
     WHERE sd.dependency_script_id = ?`,
    [id]
  );
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
  filePath: string;
  content: string;
  type: ScriptType;
  isActive?: boolean;
  hasCredentials?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const createScript = async (input: CreateScriptInput): Promise<BatchScript> => {
  const db = await getDb();

  const {
    id,
    name,
    description,
    filePath,
    content,
    type,
    isActive = true,
    hasCredentials = false,
    createdAt,
    updatedAt
  } = input;

  await db.run(
    `INSERT INTO scripts (
      id, name, description, file_path, content, type, is_active, has_credentials,
      execution_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [id, name, description ?? null, filePath, content, type, isActive ? 1 : 0, hasCredentials ? 1 : 0, createdAt, updatedAt]
  );

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
  lastExecutedAt?: string;
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

  if (updates.lastExecutedAt !== undefined) {
    assignments.push('last_executed_at = ?');
    values.push(updates.lastExecutedAt);
  }

  if (assignments.length === 0) {
    return findScriptById(id).then((detail) => (detail ? { ...detail } : null));
  }

  assignments.push('updated_at = ?');
  values.push(new Date().toISOString());

  values.push(id);

  await db.run(`UPDATE scripts SET ${assignments.join(', ')} WHERE id = ?`, values);

  const updated = await findScriptById(id);
  return updated ? { ...updated } : null;
};

export const deleteScript = async (id: string): Promise<void> => {
  const db = await getDb();
  await db.run('DELETE FROM scripts WHERE id = ?', [id]);
};

export const incrementExecutionCount = async (id: string): Promise<void> => {
  const db = await getDb();
  await db.run(
    'UPDATE scripts SET execution_count = execution_count + 1, last_executed_at = ? WHERE id = ?',
    [new Date().toISOString(), id]
  );
};

// Drive Mappings
export interface CreateDriveMappingInput {
  id: string;
  scriptId: string;
  driveLetter: string;
  networkPath: string;
  serverName?: string;
  shareName?: string;
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
    shareName,
    hasCredentials = false,
    username,
    createdAt,
    updatedAt
  } = input;

  await db.run(
    `INSERT INTO drive_mappings (
      id, script_id, drive_letter, network_path, server_name, share_name,
      has_credentials, username, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      scriptId,
      driveLetter,
      networkPath,
      serverName ?? null,
      shareName ?? null,
      hasCredentials ? 1 : 0,
      username ?? null,
      createdAt,
      updatedAt
    ]
  );

  const rowRaw: unknown = await db.get('SELECT * FROM drive_mappings WHERE id = ?', [id]);

  if (!isDriveMappingRow(rowRaw)) {
    throw new Error('Failed to create drive mapping');
  }

  return mapRowToDriveMapping(rowRaw);
};

export const deleteDriveMappingsByScriptId = async (scriptId: string): Promise<void> => {
  const db = await getDb();
  await db.run('DELETE FROM drive_mappings WHERE script_id = ?', [scriptId]);
};

export const listAllDriveMappings = async (): Promise<DriveMapping[]> => {
  const db = await getDb();
  const rowsRaw: unknown = await db.all('SELECT * FROM drive_mappings ORDER BY drive_letter');

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

  const existing: unknown = await db.get('SELECT * FROM tags WHERE name = ?', [name]);

  if (isTagRow(existing)) {
    return mapRowToTag(existing);
  }

  const now = new Date().toISOString();

  await db.run('INSERT INTO tags (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
    id,
    name,
    color ?? null,
    now,
    now
  ]);

  const created: unknown = await db.get('SELECT * FROM tags WHERE id = ?', [id]);

  if (!isTagRow(created)) {
    throw new Error('Failed to create tag');
  }

  return mapRowToTag(created);
};

export const attachTagToScript = async (scriptId: string, tagId: string): Promise<void> => {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.run('INSERT OR IGNORE INTO script_tags (script_id, tag_id, created_at) VALUES (?, ?, ?)', [
    scriptId,
    tagId,
    now
  ]);
};

export const detachTagsFromScript = async (scriptId: string): Promise<void> => {
  const db = await getDb();
  await db.run('DELETE FROM script_tags WHERE script_id = ?', [scriptId]);
};

export const listAllTags = async (): Promise<ScriptTag[]> => {
  const db = await getDb();
  const rowsRaw: unknown = await db.all('SELECT * FROM tags ORDER BY name');

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
