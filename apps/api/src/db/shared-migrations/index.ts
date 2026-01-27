// Import migrations
import * as migration0001 from './0001-create-teams.js';
import * as migration0002 from './0002-create-audit-log.js';
import * as migration0003 from './0003-create-scripts.js';
import * as migration0004 from './0004-create-controlm-jobs.js';
import * as migration0005 from './0005-create-app-info.js';
import * as migration0006 from './0006-create-tags.js';
import * as migration0007 from './0007-update-drive-mappings.js';
import * as migration0008 from './0008-create-script-dependencies.js';
import * as migration0009 from './0009-add-missing-script-columns.js';
import * as migration0010 from './0010-fix-null-timestamps.js';
import { SHARED_SCHEMA, getSearchPath, qualifyTable } from '../shared-schema.js';

import type { Pool, PoolClient } from 'pg';

export interface SharedMigration {
  id: string;
  up: (client: PoolClient) => Promise<void>;
}

export interface MigrationRunResult {
  success: boolean;
  executed: string[];
  skipped: string[];
  errors: string[];
  lockAcquired: boolean;
  executedBy?: string;
}

// Migration lock ID - unique identifier for advisory lock
// Using a hash of 'workspace_organizer_migrations' as the lock key
const MIGRATION_LOCK_ID = 7890123456;

const migrations: SharedMigration[] = [
  { id: migration0001.id, up: migration0001.up },
  { id: migration0002.id, up: migration0002.up },
  { id: migration0003.id, up: migration0003.up },
  { id: migration0004.id, up: migration0004.up },
  { id: migration0005.id, up: migration0005.up },
  { id: migration0006.id, up: migration0006.up },
  { id: migration0007.id, up: migration0007.up },
  { id: migration0008.id, up: migration0008.up },
  { id: migration0009.id, up: migration0009.up },
  { id: migration0010.id, up: migration0010.up }
];

// Re-export schema utilities
export { SHARED_SCHEMA };

/**
 * Ensure the shared schema exists in the database.
 * This is idempotent and safe to call multiple times.
 */
export const ensureSharedSchema = async (pool: Pool): Promise<void> => {
  const client = await pool.connect();
  try {
    // Create schema if it doesn't exist
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${SHARED_SCHEMA}`);
  } finally {
    client.release();
  }
};

/**
 * Check if the shared schema exists in the database.
 */
export const schemaExists = async (pool: Pool): Promise<boolean> => {
  const client = await pool.connect();
  try {
    const result = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = $1
      ) as exists`,
      [SHARED_SCHEMA]
    );
    return result.rows[0]?.exists ?? false;
  } finally {
    client.release();
  }
};

/**
 * Try to acquire an advisory lock for migrations.
 * Returns true if lock was acquired, false if another process holds it.
 */
const tryAcquireMigrationLock = async (client: PoolClient): Promise<boolean> => {
  const result = await client.query<{ pg_try_advisory_lock: boolean }>(
    'SELECT pg_try_advisory_lock($1)',
    [MIGRATION_LOCK_ID]
  );
  return result.rows[0]?.pg_try_advisory_lock ?? false;
};

/**
 * Release the advisory lock for migrations.
 */
const releaseMigrationLock = async (client: PoolClient): Promise<void> => {
  await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
};

/**
 * Run all pending migrations on the shared PostgreSQL database.
 * Uses advisory locking to prevent concurrent migration runs.
 * Creates the schema if it doesn't exist, then runs migrations within that schema.
 * 
 * @param pool - PostgreSQL connection pool
 * @param executedBy - Email/identifier of who triggered the migration (for audit)
 */
export const runSharedMigrations = async (
  pool: Pool, 
  executedBy?: string
): Promise<string[]> => {
  const result = await runSharedMigrationsWithDetails(pool, executedBy);
  if (!result.success && result.errors.length > 0) {
    throw new Error(result.errors.join('; '));
  }
  return result.executed;
};

/**
 * Run all pending migrations with detailed result information.
 * This is the preferred method for UI-triggered migrations.
 */
export const runSharedMigrationsWithDetails = async (
  pool: Pool,
  executedBy?: string
): Promise<MigrationRunResult> => {
  const client = await pool.connect();
  const result: MigrationRunResult = {
    success: true,
    executed: [],
    skipped: [],
    errors: [],
    lockAcquired: false,
    executedBy
  };
  const migrationsTable = qualifyTable('migrations');
  const searchPath = getSearchPath();

  try {
    // Try to acquire migration lock (non-blocking)
    const lockAcquired = await tryAcquireMigrationLock(client);
    result.lockAcquired = lockAcquired;

    if (!lockAcquired) {
      result.success = false;
      result.errors.push('Another migration is currently in progress. Please wait and try again.');
      return result;
    }

    // Ensure schema exists
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${SHARED_SCHEMA}`);

    // Set search_path so all unqualified table names resolve to our schema
    await client.query(`SET LOCAL search_path TO ${searchPath}`);

    // Create migrations table with extended tracking if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${migrationsTable} (
        id VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        executed_by VARCHAR(255),
        hostname VARCHAR(255)
      )
    `);

    // Add new columns if they don't exist (for existing installations)
    await client.query(`
      ALTER TABLE ${migrationsTable}
      ADD COLUMN IF NOT EXISTS executed_by VARCHAR(255),
      ADD COLUMN IF NOT EXISTS hostname VARCHAR(255)
    `);

    // Get already executed migrations
    const existingResult = await client.query<{ id: string }>(`SELECT id FROM ${migrationsTable}`);
    const executedIds = new Set(existingResult.rows.map((row) => row.id));

    // Get hostname for audit trail
    const hostnameResult = await client.query<{ hostname: string }>('SELECT current_setting(\'application_name\') as hostname');
    const hostname = hostnameResult.rows[0]?.hostname || 'unknown';

    // Run pending migrations in order
    for (const migration of migrations) {
      if (executedIds.has(migration.id)) {
        result.skipped.push(migration.id);
        continue;
      }

      await client.query('BEGIN');
      try {
        // Ensure search_path is set for migration
        await client.query(`SET LOCAL search_path TO ${searchPath}`);
        await migration.up(client);
        await client.query(
          `INSERT INTO ${migrationsTable} (id, executed_by, hostname) VALUES ($1, $2, $3)`,
          [migration.id, executedBy || 'system', hostname]
        );
        await client.query('COMMIT');
        result.executed.push(migration.id);
      } catch (error) {
        await client.query('ROLLBACK');
        const errorMessage = `Migration ${migration.id} failed: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errorMessage);
        result.success = false;
        // Stop on first error - don't run subsequent migrations
        break;
      }
    }

    return result;
  } finally {
    // Always release the lock
    if (result.lockAcquired) {
      await releaseMigrationLock(client);
    }
    client.release();
  }
};

/**
 * Get list of all migration IDs (for status checking)
 */
export const getAllMigrationIds = (): string[] => {
  return migrations.map((m) => m.id);
};

/**
 * Get pending migrations that haven't been executed yet.
 */
export const getPendingMigrations = async (pool: Pool): Promise<string[]> => {
  const executed = await getExecutedMigrations(pool);
  const executedSet = new Set(executed);
  return migrations.filter((m) => !executedSet.has(m.id)).map((m) => m.id);
};

/**
 * Get executed migrations from the database.
 * Reads from the schema-qualified migrations table.
 */
export const getExecutedMigrations = async (pool: Pool): Promise<string[]> => {
  const client = await pool.connect();
  const migrationsTable = qualifyTable('migrations');
  
  try {
    // First check if schema exists
    const schemaCheck = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = $1
      ) as exists`,
      [SHARED_SCHEMA]
    );
    
    if (!schemaCheck.rows[0]?.exists) {
      return [];
    }

    // Check if migrations table exists in schema
    const tableCheck = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = 'migrations'
      ) as exists`,
      [SHARED_SCHEMA]
    );
    
    if (!tableCheck.rows[0]?.exists) {
      return [];
    }

    const result = await client.query<{ id: string }>(
      `SELECT id FROM ${migrationsTable} ORDER BY executed_at`
    );
    return result.rows.map((row) => row.id);
  } catch {
    // Table might not exist yet
    return [];
  } finally {
    client.release();
  }
};

/**
 * Get detailed migration history including who ran each migration.
 */
export const getMigrationHistory = async (pool: Pool): Promise<Array<{
  id: string;
  executed_at: Date;
  executed_by: string | null;
  hostname: string | null;
}>> => {
  const client = await pool.connect();
  const migrationsTable = qualifyTable('migrations');
  
  try {
    const schemaCheck = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = 'migrations'
      ) as exists`,
      [SHARED_SCHEMA]
    );
    
    if (!schemaCheck.rows[0]?.exists) {
      return [];
    }

    const result = await client.query<{
      id: string;
      executed_at: Date;
      executed_by: string | null;
      hostname: string | null;
    }>(
      `SELECT id, executed_at, executed_by, hostname 
       FROM ${migrationsTable} 
       ORDER BY executed_at ASC`
    );
    return result.rows;
  } catch {
    return [];
  } finally {
    client.release();
  }
};
