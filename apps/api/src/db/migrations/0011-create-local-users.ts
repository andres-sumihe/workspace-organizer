import type { Database } from 'sqlite';

export const id = '0011-create-local-users';

/**
 * Migration: Local Users (Solo Mode Authentication)
 * 
 * Creates the local_users table for offline-capable single-user authentication.
 * This table is used in Solo mode when the app runs without a shared database.
 */
export const up = async (db: Database) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS local_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_local_users_username ON local_users(username);
    CREATE INDEX IF NOT EXISTS idx_local_users_email ON local_users(email);
    CREATE INDEX IF NOT EXISTS idx_local_users_active ON local_users(is_active);
  `);
};
