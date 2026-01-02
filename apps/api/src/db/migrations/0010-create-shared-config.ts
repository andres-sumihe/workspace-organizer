import type Database from 'better-sqlite3';

export const id = '0010-create-shared-config';

/**
 * Migration to add shared database configuration to settings.
 * The shared_db_connection setting stores the PostgreSQL connection string.
 */
export const up = async (db: Database.Database) => {
  // Insert default shared_db_connection as null (not configured)
  db.prepare(
    `INSERT OR IGNORE INTO settings (key, value_json, description) VALUES (?, ?, ?)`
  ).run('shared_db_connection', JSON.stringify(null), 'PostgreSQL connection string for shared database');

  // Insert installation_completed flag as false
  db.prepare(
    `INSERT OR IGNORE INTO settings (key, value_json, description) VALUES (?, ?, ?)`
  ).run('installation_completed', JSON.stringify(false), 'Whether initial installation has been completed');

  // Insert admin_user_id as null (not created)
  db.prepare(
    `INSERT OR IGNORE INTO settings (key, value_json, description) VALUES (?, ?, ?)`
  ).run('admin_user_id', JSON.stringify(null), 'ID of the admin user created during installation');
};



