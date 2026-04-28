import type Database from 'better-sqlite3';

export const id = '0024-add-reported-at-to-work-logs';

export const up = async (db: Database.Database) => {
  db.exec(`
    ALTER TABLE work_logs ADD COLUMN reported_at TEXT;

    CREATE INDEX IF NOT EXISTS idx_work_logs_reported_at ON work_logs(reported_at);
  `);
};
