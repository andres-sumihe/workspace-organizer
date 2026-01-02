import { v4 as uuidv4 } from 'uuid';

import { getDb } from '../db/client.js';
import { getSharedPool } from '../db/shared-client.js';

import type { MigrationMapping, MigrationResult, MigrationOptions } from '@workspace/shared';

/**
 * Migration Service
 * 
 * Safely migrates local Solo mode data to shared PostgreSQL database.
 * Maintains ID mappings for idempotency and provides dry-run capability.
 */

export const migrationService = {
  /**
   * Get migration status - check what data can be migrated
   */
  async getStatus(): Promise<{
    scriptsCount: number;
    jobsCount: number;
    alreadyMigrated: { scripts: number; jobs: number };
  }> {
    const localDb = await getDb();

    // Count local scripts not yet migrated
    const scriptsRow = localDb.prepare(
      'SELECT COUNT(*) as count FROM scripts WHERE migrated_to_shared IS NULL'
    ).get() as { count: number };

    const migratedScriptsRow = localDb.prepare(
      'SELECT COUNT(*) as count FROM scripts WHERE migrated_to_shared IS NOT NULL'
    ).get() as { count: number };

    // Count local Control-M jobs (if table exists)
    let jobsCount = 0;
    let migratedJobsCount = 0;
    
    try {
      const jobsRow = localDb.prepare(
        'SELECT COUNT(*) as count FROM controlm_jobs'
      ).get() as { count: number };
      jobsCount = jobsRow?.count || 0;
    } catch {
      // Table doesn't exist yet
    }

    return {
      scriptsCount: scriptsRow?.count || 0,
      jobsCount,
      alreadyMigrated: {
        scripts: migratedScriptsRow?.count || 0,
        jobs: migratedJobsCount
      }
    };
  },

  /**
   * Migrate scripts from local to shared database
   */
  async migrateScripts(options: MigrationOptions = {}): Promise<MigrationResult> {
    const { dryRun = false } = options;
    const localDb = await getDb();
    const errors: string[] = [];
    let itemsMigrated = 0;

    try {
      // Get all local scripts not yet migrated
      const scripts = localDb.prepare(
        'SELECT * FROM scripts WHERE migrated_to_shared IS NULL'
      ).all() as Array<{
        id: string;
        name: string;
        file_path: string;
        content: string;
        description: string | null;
        workspace_id: string;
        created_at: string;
        updated_at: string;
      }>;

      if (scripts.length === 0) {
        return {
          success: true,
          itemsMigrated: 0,
          errors: [],
          dryRun
        };
      }

      if (dryRun) {
        return {
          success: true,
          itemsMigrated: scripts.length,
          errors: [],
          dryRun: true
        };
      }

      // Begin transaction in shared database
      const pool = getSharedPool();
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // TODO: Get team_id and user_id from configuration
        // For now, we'll use a placeholder team
        const teamId = '00000000-0000-0000-0000-000000000000';
        const userId = '00000000-0000-0000-0000-000000000000';

        for (const script of scripts) {
          const sharedId = uuidv4();
          const now = new Date().toISOString();

          try {
            // Insert into shared database
            await client.query(
              `INSERT INTO scripts (
                id, team_id, name, file_path, content, description,
                created_by, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                sharedId,
                teamId,
                script.name,
                script.file_path,
                script.content,
                script.description,
                userId,
                script.created_at,
                now
              ]
            );

            // Record mapping in local database
            localDb.prepare(
              `INSERT INTO migration_mappings (local_id, shared_id, table_name, migrated_at)
               VALUES (?, ?, 'scripts', ?)`
            ).run(script.id, sharedId, now);

            // Mark script as migrated
            localDb.prepare(
              'UPDATE scripts SET migrated_to_shared = ? WHERE id = ?'
            ).run(sharedId, script.id);

            itemsMigrated++;
          } catch (error) {
            errors.push(`Failed to migrate script ${script.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      return {
        success: errors.length === 0,
        itemsMigrated,
        errors,
        dryRun: false
      };
    } catch (error) {
      return {
        success: false,
        itemsMigrated,
        errors: [error instanceof Error ? error.message : 'Migration failed'],
        dryRun
      };
    }
  },

  /**
   * Get migration mappings for a specific table
   */
  async getMappings(tableName: string): Promise<MigrationMapping[]> {
    const localDb = await getDb();
    
    const rows = localDb.prepare(
      'SELECT local_id, shared_id, table_name, migrated_at FROM migration_mappings WHERE table_name = ?'
    ).all(tableName) as Array<{
      local_id: string;
      shared_id: string;
      table_name: string;
      migrated_at: string;
    }>;

    return rows.map(row => ({
      localId: row.local_id,
      sharedId: row.shared_id,
      tableName: row.table_name,
      migratedAt: row.migrated_at
    }));
  },

  /**
   * Get shared ID for a local ID
   */
  async getSharedId(localId: string, tableName: string): Promise<string | null> {
    const localDb = await getDb();
    
    const row = localDb.prepare(
      'SELECT shared_id FROM migration_mappings WHERE local_id = ? AND table_name = ?'
    ).get(localId, tableName) as { shared_id: string } | undefined;

    return row?.shared_id ?? null;
  },

  /**
   * Rollback migration (mark items as not migrated)
   * Does NOT delete from shared database - use with caution
   */
  async rollback(tableName: string): Promise<{ success: boolean; message: string }> {
    const localDb = await getDb();

    try {
      // Clear migration mappings
      localDb.prepare(
        'DELETE FROM migration_mappings WHERE table_name = ?'
      ).run(tableName);

      // Reset migrated flag on scripts
      if (tableName === 'scripts') {
        localDb.prepare(
          'UPDATE scripts SET migrated_to_shared = NULL'
        ).run();
      }

      return {
        success: true,
        message: `Rollback completed for ${tableName}`
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Rollback failed'
      };
    }
  }
};
