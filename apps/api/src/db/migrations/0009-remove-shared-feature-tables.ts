import type Database from 'better-sqlite3';

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
export const up = async (db: Database.Database) => {
  // Disable foreign key constraints temporarily to allow dropping tables
  db.exec('PRAGMA foreign_keys = OFF;');

  // Drop Control-M job tables (in dependency order)
  db.exec('DROP TABLE IF EXISTS controlm_job_conditions;');
  db.exec('DROP TABLE IF EXISTS controlm_job_dependencies;');
  db.exec('DROP TABLE IF EXISTS controlm_jobs;');

  // Drop Script-related tables (in dependency order)
  db.exec('DROP TABLE IF EXISTS script_dependencies;');
  db.exec('DROP TABLE IF EXISTS script_tags;');
  db.exec('DROP TABLE IF EXISTS drive_mappings;');
  db.exec('DROP TABLE IF EXISTS scripts;');
  db.exec('DROP TABLE IF EXISTS tags;');

  // Re-enable foreign key constraints
  db.exec('PRAGMA foreign_keys = ON;');
};



