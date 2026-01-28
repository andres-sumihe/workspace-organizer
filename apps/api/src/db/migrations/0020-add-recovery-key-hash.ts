import type Database from 'better-sqlite3';

export const id = '0020-add-recovery-key-hash';

/**
 * Migration: Add Recovery Key Hash to Local Users
 *
 * Adds a recovery_key_hash column to local_users table.
 * Used for password recovery without data loss.
 */
export const up = async (db: Database.Database) => {
  db.exec(`
    ALTER TABLE local_users ADD COLUMN recovery_key_hash TEXT;
  `);
};
