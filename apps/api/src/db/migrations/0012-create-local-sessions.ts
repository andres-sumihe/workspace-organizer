import type { Database } from 'sqlite';

export const id = '0012-create-local-sessions';

/**
 * Migration: Local Sessions (Solo Mode JWT Management)
 * 
 * Creates the local_sessions table for tracking refresh tokens and session lifecycle
 * for local authentication in Solo mode.
 */
export const up = async (db: Database) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS local_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      refresh_token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES local_users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_local_sessions_user ON local_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_local_sessions_token ON local_sessions(refresh_token);
    CREATE INDEX IF NOT EXISTS idx_local_sessions_expires ON local_sessions(expires_at);
  `);
};
