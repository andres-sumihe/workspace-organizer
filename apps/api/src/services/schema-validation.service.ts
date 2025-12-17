import { getSharedPool, isSharedDbConnected, SHARED_SCHEMA } from '../db/shared-client.js';

import type { Pool } from 'pg';

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

export interface SchemaValidationResult {
  table: string;
  exists: boolean;
  expectedColumns?: string[];
  actualColumns?: string[];
  missingColumns?: string[];
  extraColumns?: string[];
  valid: boolean;
  errors: string[];
}

/**
 * Expected schema definitions for all shared DB tables
 * These should match what the migrations in shared-migrations/ actually create
 */
const EXPECTED_SCHEMAS: Record<string, string[]> = {
  teams: [
    'id',
    'name',
    'description',
    'created_by_email',
    'created_at',
    'updated_at'
  ],
  team_members: [
    'id',
    'team_id',
    'email',
    'display_name',
    'role',
    'joined_at',
    'updated_at'
  ],
  audit_log: [
    'id',
    'team_id',
    'member_email',
    'member_display_name',
    'action',
    'resource_type',
    'resource_id',
    'old_value',
    'new_value',
    'ip_address',
    'user_agent',
    'metadata',
    'timestamp'
  ],
  scripts: [
    'id',
    'team_id',
    'name',
    'description',
    'file_path',
    'content',
    'type',
    'is_active',
    'tags',
    'created_by',
    'updated_by',
    'created_at',
    'updated_at'
  ],
  drive_mappings: [
    'id',
    'team_id',
    'drive_letter',
    'unc_path',
    'description',
    'is_active',
    'created_by_email',
    'created_at',
    'updated_at'
  ],
  script_drive_mappings: [
    'script_id',
    'drive_mapping_id'
  ],
  controlm_jobs: [
    'id',
    'job_id',
    'application',
    'group_name',
    'mem_name',
    'job_name',
    'description',
    'node_id',
    'owner',
    'task_type',
    'is_cyclic',
    'priority',
    'is_critical',
    'days_calendar',
    'weeks_calendar',
    'from_time',
    'to_time',
    'interval_value',
    'mem_lib',
    'author',
    'creation_user',
    'creation_date',
    'change_user_id',
    'change_date',
    'is_active',
    'linked_script_id',
    'created_at',
    'updated_at'
  ],
  job_dependencies: [
    'id',
    'predecessor_job_id',
    'successor_job_id',
    'condition_type',
    'created_at'
  ],
  job_conditions: [
    'id',
    'job_id',
    'condition_name',
    'condition_type',
    'odate',
    'created_at'
  ],
  app_info: [
    'server_id',
    'team_id',
    'team_name',
    'public_key',
    'created_at',
    'updated_at'
  ],
  app_secrets: [
    'key',
    'value',
    'created_at',
    'updated_at'
  ]
};

/**
 * Validate that all shared database tables match expected schema
 */
export const schemaValidationService = {
  /**
   * Get columns for a specific table in the shared schema
   */
  async getTableColumns(pool: Pool, tableName: string): Promise<ColumnInfo[]> {
    const result = await pool.query<ColumnInfo>(
      `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
      `,
      [SHARED_SCHEMA, tableName]
    );
    return result.rows;
  },

  /**
   * Check if a table exists in the shared schema
   */
  async tableExists(pool: Pool, tableName: string): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      ) as exists
      `,
      [SHARED_SCHEMA, tableName]
    );
    return result.rows[0]?.exists ?? false;
  },

  /**
   * Validate a single table schema
   */
  async validateTable(pool: Pool, tableName: string): Promise<SchemaValidationResult> {
    const result: SchemaValidationResult = {
      table: tableName,
      exists: false,
      valid: false,
      errors: []
    };

    const expectedColumns = EXPECTED_SCHEMAS[tableName];
    if (!expectedColumns) {
      result.errors.push(`No schema definition found for table '${tableName}'`);
      return result;
    }

    result.expectedColumns = expectedColumns;

    // Check if table exists
    const exists = await this.tableExists(pool, tableName);
    result.exists = exists;

    if (!exists) {
      result.errors.push(`Table '${tableName}' does not exist in schema '${SHARED_SCHEMA}'`);
      return result;
    }

    // Get actual columns
    const columns = await this.getTableColumns(pool, tableName);
    result.actualColumns = columns.map((c) => c.column_name);

    // Find missing and extra columns
    const actualSet = new Set(result.actualColumns);
    const expectedSet = new Set(expectedColumns);

    result.missingColumns = expectedColumns.filter((col) => !actualSet.has(col));
    result.extraColumns = result.actualColumns.filter((col) => !expectedSet.has(col));

    // Table is valid if no missing columns (extra columns are okay for future compatibility)
    result.valid = result.missingColumns.length === 0;

    if (result.missingColumns.length > 0) {
      result.errors.push(
        `Missing required columns: ${result.missingColumns.join(', ')}`
      );
    }

    return result;
  },

  /**
   * Validate all shared database tables
   */
  async validateAllTables(): Promise<{
    valid: boolean;
    tables: Record<string, SchemaValidationResult>;
    summary: {
      total: number;
      valid: number;
      invalid: number;
      missing: number;
    };
  }> {
    if (!isSharedDbConnected()) {
      throw new Error('Shared database is not connected');
    }

    const pool = getSharedPool();
    const tableNames = Object.keys(EXPECTED_SCHEMAS);
    const results: Record<string, SchemaValidationResult> = {};

    for (const tableName of tableNames) {
      results[tableName] = await this.validateTable(pool, tableName);
    }

    const summary = {
      total: tableNames.length,
      valid: 0,
      invalid: 0,
      missing: 0
    };

    for (const result of Object.values(results)) {
      if (!result.exists) {
        summary.missing++;
      } else if (result.valid) {
        summary.valid++;
      } else {
        summary.invalid++;
      }
    }

    const allValid = summary.invalid === 0 && summary.missing === 0;

    return {
      valid: allValid,
      tables: results,
      summary
    };
  },

  /**
   * Reset entire shared database (DROP all tables and migrations table)
   * WARNING: This is destructive and will delete all data!
   */
  async resetDatabase(): Promise<{ success: boolean; message: string; tablesDropped: string[] }> {
    if (!isSharedDbConnected()) {
      throw new Error('Shared database is not connected');
    }

    const pool = getSharedPool();
    const client = await pool.connect();
    const droppedTables: string[] = [];

    try {
      await client.query('BEGIN');

      // Get all tables in the schema
      const result = await client.query<{ tablename: string }>(
        `
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = $1
        ORDER BY tablename
        `,
        [SHARED_SCHEMA]
      );

      // Drop all tables in cascade mode (handles foreign keys)
      for (const row of result.rows) {
        const qualifiedTable = `${SHARED_SCHEMA}.${row.tablename}`;
        await client.query(`DROP TABLE IF EXISTS ${qualifiedTable} CASCADE`);
        droppedTables.push(row.tablename);
      }

      await client.query('COMMIT');

      return {
        success: true,
        message: `Successfully dropped ${droppedTables.length} tables from schema '${SHARED_SCHEMA}'`,
        tablesDropped: droppedTables
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
};
