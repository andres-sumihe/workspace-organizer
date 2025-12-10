import type { Database } from 'sqlite';

export const id = '0009-remove-shared-feature-tables';

/**
 * Migration to remove Scripts and Control-M Jobs tables from local SQLite database.
 * These tables are being migrated to the shared PostgreSQL database.
 *
 * Tables removed:
 * - scripts
 * - script_tags
 * - script_dependencies
 * - tags
 * - drive_mappings
 * - controlm_jobs
 * - controlm_job_dependencies
 * - controlm_job_conditions
 */
export const up = async (db: Database) => {
  // Disable foreign key constraints temporarily to allow dropping tables
  await db.exec('PRAGMA foreign_keys = OFF;');

  // Drop Control-M job tables (in dependency order)
  await db.exec('DROP TABLE IF EXISTS controlm_job_conditions;');
  await db.exec('DROP TABLE IF EXISTS controlm_job_dependencies;');
  await db.exec('DROP TABLE IF EXISTS controlm_jobs;');

  // Drop Script-related tables (in dependency order)
  await db.exec('DROP TABLE IF EXISTS script_dependencies;');
  await db.exec('DROP TABLE IF EXISTS script_tags;');
  await db.exec('DROP TABLE IF EXISTS drive_mappings;');
  await db.exec('DROP TABLE IF EXISTS scripts;');
  await db.exec('DROP TABLE IF EXISTS tags;');

  // Re-enable foreign key constraints
  await db.exec('PRAGMA foreign_keys = ON;');
};
