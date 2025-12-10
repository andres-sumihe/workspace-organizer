import type { Database } from 'sqlite';

export const id = '0010-create-shared-config';

/**
 * Migration to add shared database configuration to settings.
 * The shared_db_connection setting stores the PostgreSQL connection string.
 */
export const up = async (db: Database) => {
  // Insert default shared_db_connection as null (not configured)
  await db.run(
    `INSERT OR IGNORE INTO settings (key, value_json, description) VALUES (?, ?, ?)`,
    ['shared_db_connection', JSON.stringify(null), 'PostgreSQL connection string for shared database']
  );

  // Insert installation_completed flag as false
  await db.run(
    `INSERT OR IGNORE INTO settings (key, value_json, description) VALUES (?, ?, ?)`,
    ['installation_completed', JSON.stringify(false), 'Whether initial installation has been completed']
  );

  // Insert admin_user_id as null (not created)
  await db.run(
    `INSERT OR IGNORE INTO settings (key, value_json, description) VALUES (?, ?, ?)`,
    ['admin_user_id', JSON.stringify(null), 'ID of the admin user created during installation']
  );
};
