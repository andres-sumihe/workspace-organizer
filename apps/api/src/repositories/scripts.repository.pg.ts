/**
 * Scripts repository for PostgreSQL shared database.
 *
 * This repository replaces the SQLite version and works with the shared PostgreSQL database.
 */

import { query, queryOne, execute, getSharedClient } from '../db/shared-client.js';

import type { BatchScript, BatchScriptDetail, DriveMapping, ScriptTag, ScriptType } from '@workspace/shared';

// Database row types for PostgreSQL
interface ScriptRow {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  content: string;
  type: string;
  is_active: boolean;
  has_credentials: boolean;
  execution_count: number;
  last_executed_at: string | null;
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
  share_name: string | null;
  has_credentials: boolean;
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

interface LinkedJobRow {
  id: string;
  job_id: number;
  job_name: string;
  application: string;
  node_id: string;
}

// Map database row to BatchScript
const mapRowToScript = (row: ScriptRow): BatchScript => ({
  id: row.id,
  name: row.name,
  description: row.description ?? undefined,
  filePath: row.file_path,
  content: row.content,
  type: row.type as ScriptType,
  isActive: row.is_active,
  hasCredentials: row.has_credentials,
  executionCount: row.execution_count,
  lastExecutedAt: row.last_executed_at ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Map database row to DriveMapping
const mapRowToDriveMapping = (row: DriveMappingRow): DriveMapping => ({
  id: row.id,
  scriptId: row.script_id,
  driveLetter: row.drive_letter,
  networkPath: row.network_path,
  serverName: row.server_name ?? undefined,
  shareName: row.share_name ?? undefined,
  hasCredentials: row.has_credentials,
  username: row.username ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Map database row to ScriptTag
const mapRowToTag = (row: TagRow): ScriptTag => ({
  id: row.id,
  name: row.name,
  color: row.color ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export interface ListScriptsParams {
  limit: number;
  offset: number;
  type?: ScriptType;
  isActive?: boolean;
  driveLetter?: string;
  tagId?: string;
  searchQuery?: string;
}

export const scriptsRepository = {
  /**
   * List scripts with optional filters
   */
  async list(params: ListScriptsParams): Promise<BatchScript[]> {
    const { limit, offset, type, isActive, driveLetter, tagId, searchQuery } = params;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (type !== undefined) {
      conditions.push(`s.type = $${paramIndex++}`);
      values.push(type);
    }

    if (isActive !== undefined) {
      conditions.push(`s.is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (driveLetter !== undefined) {
      conditions.push(`EXISTS (SELECT 1 FROM drive_mappings dm WHERE dm.script_id = s.id AND dm.drive_letter = $${paramIndex++})`);
      values.push(driveLetter);
    }

    if (tagId !== undefined) {
      conditions.push(`EXISTS (SELECT 1 FROM script_tags st WHERE st.script_id = s.id AND st.tag_id = $${paramIndex++})`);
      values.push(tagId);
    }

    if (searchQuery !== undefined && searchQuery.trim() !== '') {
      conditions.push(`(s.name ILIKE $${paramIndex} OR s.file_path ILIKE $${paramIndex} OR s.description ILIKE $${paramIndex})`);
      values.push(`%${searchQuery}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    values.push(limit, offset);

    const rows = await query<ScriptRow>(
      `SELECT s.* FROM scripts s ${whereClause} ORDER BY s.name LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      values
    );

    return rows.map(mapRowToScript);
  },

  /**
   * Count scripts with optional filters
   */
  async count(params: Omit<ListScriptsParams, 'limit' | 'offset'>): Promise<number> {
    const { type, isActive, driveLetter, tagId, searchQuery } = params;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (type !== undefined) {
      conditions.push(`s.type = $${paramIndex++}`);
      values.push(type);
    }

    if (isActive !== undefined) {
      conditions.push(`s.is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (driveLetter !== undefined) {
      conditions.push(`EXISTS (SELECT 1 FROM drive_mappings dm WHERE dm.script_id = s.id AND dm.drive_letter = $${paramIndex++})`);
      values.push(driveLetter);
    }

    if (tagId !== undefined) {
      conditions.push(`EXISTS (SELECT 1 FROM script_tags st WHERE st.script_id = s.id AND st.tag_id = $${paramIndex++})`);
      values.push(tagId);
    }

    if (searchQuery !== undefined && searchQuery.trim() !== '') {
      conditions.push(`(s.name ILIKE $${paramIndex} OR s.file_path ILIKE $${paramIndex} OR s.description ILIKE $${paramIndex})`);
      values.push(`%${searchQuery}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await queryOne<{ count: string }>(
      `SELECT COUNT(1) as count FROM scripts s ${whereClause}`,
      values
    );

    return result ? parseInt(result.count, 10) : 0;
  },

  /**
   * Get script by ID
   */
  async getById(id: string): Promise<BatchScript | null> {
    const row = await queryOne<ScriptRow>(
      'SELECT * FROM scripts WHERE id = $1',
      [id]
    );

    return row ? mapRowToScript(row) : null;
  },

  /**
   * Get script with all details (mappings, tags, dependencies)
   */
  async getDetail(id: string): Promise<BatchScriptDetail | null> {
    const row = await queryOne<ScriptRow>(
      'SELECT * FROM scripts WHERE id = $1',
      [id]
    );

    if (!row) return null;

    const script = mapRowToScript(row);

    // Get drive mappings
    const mappingRows = await query<DriveMappingRow>(
      'SELECT * FROM drive_mappings WHERE script_id = $1 ORDER BY drive_letter',
      [id]
    );
    const driveMappings = mappingRows.map(mapRowToDriveMapping);

    // Get tags
    const tagRows = await query<TagRow>(
      `SELECT t.* FROM tags t
       INNER JOIN script_tags st ON t.id = st.tag_id
       WHERE st.script_id = $1
       ORDER BY t.name`,
      [id]
    );
    const tags = tagRows.map(mapRowToTag);

    // Get dependencies (scripts this script depends on)
    const dependencyRows = await query<ScriptRow>(
      `SELECT s.* FROM scripts s
       INNER JOIN script_dependencies sd ON s.id = sd.dependency_script_id
       WHERE sd.dependent_script_id = $1
       ORDER BY s.name`,
      [id]
    );
    const dependencies = dependencyRows.map(mapRowToScript);

    // Get dependents (scripts that depend on this script)
    const dependentRows = await query<ScriptRow>(
      `SELECT s.* FROM scripts s
       INNER JOIN script_dependencies sd ON s.id = sd.dependent_script_id
       WHERE sd.dependency_script_id = $1
       ORDER BY s.name`,
      [id]
    );
    const dependents = dependentRows.map(mapRowToScript);

    // Get linked Control-M jobs
    const linkedJobRows = await query<LinkedJobRow>(
      `SELECT id, job_id, job_name, application, node_id
       FROM controlm_jobs
       WHERE linked_script_id = $1
       ORDER BY job_name`,
      [id]
    );
    const linkedJobs = linkedJobRows.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      jobName: r.job_name,
      application: r.application,
      nodeId: r.node_id
    }));

    return {
      ...script,
      driveMappings,
      tags,
      dependencies,
      dependents,
      linkedJobs
    };
  },

  /**
   * Create a new script
   */
  async create(
    data: {
      name: string;
      description?: string;
      filePath: string;
      content: string;
      type?: ScriptType;
      isActive?: boolean;
      tagIds?: string[];
    },
    userId?: string
  ): Promise<BatchScript> {
    const client = await getSharedClient();

    try {
      await client.query('BEGIN');

      const result = await client.query<ScriptRow>(
        `INSERT INTO scripts (name, description, file_path, content, type, is_active, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         RETURNING *`,
        [
          data.name,
          data.description ?? null,
          data.filePath,
          data.content,
          data.type ?? 'batch',
          data.isActive ?? true,
          userId ?? null
        ]
      );

      const script = mapRowToScript(result.rows[0]);

      // Add tags if provided
      if (data.tagIds && data.tagIds.length > 0) {
        for (const tagId of data.tagIds) {
          await client.query(
            'INSERT INTO script_tags (script_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [script.id, tagId]
          );
        }
      }

      await client.query('COMMIT');
      return script;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Update a script
   */
  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      content?: string;
      type?: ScriptType;
      isActive?: boolean;
      tagIds?: string[];
    },
    userId?: string
  ): Promise<BatchScript | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const client = await getSharedClient();

    try {
      await client.query('BEGIN');

      const updates: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(data.name);
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }

      if (data.content !== undefined) {
        updates.push(`content = $${paramIndex++}`);
        values.push(data.content);
      }

      if (data.type !== undefined) {
        updates.push(`type = $${paramIndex++}`);
        values.push(data.type);
      }

      if (data.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(data.isActive);
      }

      if (userId) {
        updates.push(`updated_by = $${paramIndex++}`);
        values.push(userId);
      }

      updates.push('updated_at = NOW()');

      values.push(id);

      const result = await client.query<ScriptRow>(
        `UPDATE scripts SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      // Update tags if provided
      if (data.tagIds !== undefined) {
        await client.query('DELETE FROM script_tags WHERE script_id = $1', [id]);
        for (const tagId of data.tagIds) {
          await client.query(
            'INSERT INTO script_tags (script_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [id, tagId]
          );
        }
      }

      await client.query('COMMIT');
      return mapRowToScript(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Delete a script
   */
  async delete(id: string): Promise<boolean> {
    const result = await execute('DELETE FROM scripts WHERE id = $1', [id]);
    return result > 0;
  },

  /**
   * Find scripts by filename pattern
   */
  async findByFilename(filename: string): Promise<BatchScript[]> {
    const normalizedFilename = filename.replace(/\.[^.]+$/, '').toUpperCase();

    const rows = await query<ScriptRow>(
      `SELECT * FROM scripts
       WHERE UPPER(name) = $1
          OR UPPER(name) = $2
          OR UPPER(file_path) LIKE $3
       ORDER BY name`,
      [filename.toUpperCase(), normalizedFilename, `%${filename.toUpperCase()}`]
    );

    return rows.map(mapRowToScript);
  },

  /**
   * Find a script by exact name
   */
  async findByName(name: string): Promise<BatchScript | null> {
    const row = await queryOne<ScriptRow>(
      'SELECT * FROM scripts WHERE UPPER(name) = $1',
      [name.toUpperCase()]
    );

    return row ? mapRowToScript(row) : null;
  },

  /**
   * Get all tags
   */
  async getAllTags(): Promise<ScriptTag[]> {
    const rows = await query<TagRow>('SELECT * FROM tags ORDER BY name');
    return rows.map(mapRowToTag);
  },

  /**
   * Create a tag
   */
  async createTag(name: string, color?: string): Promise<ScriptTag> {
    const result = await query<TagRow>(
      'INSERT INTO tags (name, color) VALUES ($1, $2) RETURNING *',
      [name, color ?? null]
    );
    return mapRowToTag(result[0]);
  },

  /**
   * Delete a tag
   */
  async deleteTag(id: string): Promise<boolean> {
    const result = await execute('DELETE FROM tags WHERE id = $1', [id]);
    return result > 0;
  },

  /**
   * Add drive mapping to a script
   */
  async addDriveMapping(
    scriptId: string,
    mapping: {
      driveLetter: string;
      networkPath: string;
      serverName?: string;
      shareName?: string;
      hasCredentials?: boolean;
      username?: string;
    }
  ): Promise<DriveMapping> {
    const result = await query<DriveMappingRow>(
      `INSERT INTO drive_mappings (script_id, drive_letter, network_path, server_name, share_name, has_credentials, username)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        scriptId,
        mapping.driveLetter,
        mapping.networkPath,
        mapping.serverName ?? null,
        mapping.shareName ?? null,
        mapping.hasCredentials ?? false,
        mapping.username ?? null
      ]
    );
    return mapRowToDriveMapping(result[0]);
  },

  /**
   * Get drive mappings for a script
   */
  async getDriveMappings(scriptId: string): Promise<DriveMapping[]> {
    const rows = await query<DriveMappingRow>(
      'SELECT * FROM drive_mappings WHERE script_id = $1 ORDER BY drive_letter',
      [scriptId]
    );
    return rows.map(mapRowToDriveMapping);
  },

  /**
   * Delete all drive mappings for a script
   */
  async clearDriveMappings(scriptId: string): Promise<void> {
    await execute('DELETE FROM drive_mappings WHERE script_id = $1', [scriptId]);
  }
};

// Export legacy function names for compatibility
export const listScripts = scriptsRepository.list.bind(scriptsRepository);
export const countScripts = scriptsRepository.count.bind(scriptsRepository);
export const findScriptsByFilename = scriptsRepository.findByFilename.bind(scriptsRepository);
export const findScriptByName = scriptsRepository.findByName.bind(scriptsRepository);
