// Import migrations
import * as migration0001 from './0001-create-teams.js';
import * as migration0002 from './0002-create-audit-log.js';
import * as migration0003 from './0003-create-scripts.js';
import * as migration0004 from './0004-create-controlm-jobs.js';
import * as migration0005 from './0005-create-app-info.js';
import { SHARED_SCHEMA, getSearchPath, qualifyTable } from '../shared-schema.js';

import type { Pool, PoolClient } from 'pg';

export interface SharedMigration {
  id: string;
  up: (client: PoolClient) => Promise<void>;
}

const migrations: SharedMigration[] = [
  { id: migration0001.id, up: migration0001.up },
  { id: migration0002.id, up: migration0002.up },
  { id: migration0003.id, up: migration0003.up },
  { id: migration0004.id, up: migration0004.up },
  { id: migration0005.id, up: migration0005.up }
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
 * Run all pending migrations on the shared PostgreSQL database.
 * Creates the schema if it doesn't exist, then runs migrations within that schema.
 */
export const runSharedMigrations = async (pool: Pool): Promise<string[]> => {
  const client = await pool.connect();
  const executedMigrations: string[] = [];
  const migrationsTable = qualifyTable('migrations');
  const searchPath = getSearchPath();

  try {
    // Ensure schema exists
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${SHARED_SCHEMA}`);

    // Set search_path so all unqualified table names resolve to our schema
    await client.query(`SET LOCAL search_path TO ${searchPath}`);

    // Create migrations table if it doesn't exist (schema-qualified)
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${migrationsTable} (
        id VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    // Get already executed migrations
    const result = await client.query<{ id: string }>(`SELECT id FROM ${migrationsTable}`);
    const executedIds = new Set(result.rows.map((row) => row.id));

    // Run pending migrations in order
    for (const migration of migrations) {
      if (executedIds.has(migration.id)) {
        continue;
      }

      await client.query('BEGIN');
      try {
        // Ensure search_path is set for migration (in case of nested transactions)
        await client.query(`SET LOCAL search_path TO ${searchPath}`);
        await migration.up(client);
        await client.query(`INSERT INTO ${migrationsTable} (id) VALUES ($1)`, [migration.id]);
        await client.query('COMMIT');
        executedMigrations.push(migration.id);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(
          `Migration ${migration.id} failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return executedMigrations;
  } finally {
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
