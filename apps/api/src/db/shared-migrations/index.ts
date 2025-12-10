// Import migrations
import * as migration0001 from './0001-create-users.js';
import * as migration0002 from './0002-create-rbac.js';
import * as migration0003 from './0003-create-audit-log.js';
import * as migration0004 from './0004-create-scripts.js';
import * as migration0005 from './0005-create-controlm-jobs.js';

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

/**
 * Run all pending migrations on the shared PostgreSQL database
 */
export const runSharedMigrations = async (pool: Pool): Promise<string[]> => {
  const client = await pool.connect();
  const executedMigrations: string[] = [];

  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    // Get already executed migrations
    const result = await client.query<{ id: string }>('SELECT id FROM migrations');
    const executedIds = new Set(result.rows.map((row) => row.id));

    // Run pending migrations in order
    for (const migration of migrations) {
      if (executedIds.has(migration.id)) {
        continue;
      }

      await client.query('BEGIN');
      try {
        await migration.up(client);
        await client.query('INSERT INTO migrations (id) VALUES ($1)', [migration.id]);
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
 * Get executed migrations from the database
 */
export const getExecutedMigrations = async (pool: Pool): Promise<string[]> => {
  const client = await pool.connect();
  try {
    const result = await client.query<{ id: string }>(
      'SELECT id FROM migrations ORDER BY executed_at'
    );
    return result.rows.map((row) => row.id);
  } catch {
    // Table might not exist yet
    return [];
  } finally {
    client.release();
  }
};
