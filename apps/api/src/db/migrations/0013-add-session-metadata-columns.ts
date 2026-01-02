import type Database from 'better-sqlite3';

export const id = '0013-add-session-metadata-columns';

/**
 * Migration: Ensure local_sessions has activity metadata columns
 *
 * Earlier installs may have created the local_sessions table before
 * last_activity_at / ip_address / user_agent columns were introduced.
 * This migration backfills those columns in-place to avoid insert errors.
 */
export const up = async (db: Database.Database): Promise<void> => {
  // Ensure the local_sessions table exists before attempting to alter it
  const tableInfo = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='local_sessions'"
  ).get() as { name?: string } | undefined;

  if (!tableInfo) {
    return;
  }

  const existingColumnsRaw = db.prepare('PRAGMA table_info(local_sessions)').all();
  const existingColumns = Array.isArray(existingColumnsRaw)
    ? (existingColumnsRaw as Array<{ name?: string }>)
    : [];

  const hasColumn = (column: string): boolean =>
    existingColumns.some((col) => col?.name === column);

  const alterations: Array<{ column: string; definition: string }> = [
    { column: 'last_activity_at', definition: "TEXT DEFAULT (datetime('now'))" },
    { column: 'ip_address', definition: 'TEXT' },
    { column: 'user_agent', definition: 'TEXT' }
  ];

  for (const { column, definition } of alterations) {
    if (!hasColumn(column)) {
      db.exec(`ALTER TABLE local_sessions ADD COLUMN ${column} ${definition}`);
    }
  }

  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_local_sessions_activity ON local_sessions(last_activity_at)'
  );
};



