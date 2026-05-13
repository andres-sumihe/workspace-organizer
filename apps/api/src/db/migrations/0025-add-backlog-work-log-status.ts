import type Database from 'better-sqlite3';

export const id = '0025-add-backlog-work-log-status';

export const up = async (db: Database.Database) => {
  db.exec(`
    DROP TRIGGER IF EXISTS trg_work_logs_set_updated_at;

    ALTER TABLE work_logs RENAME TO work_logs_old;

    CREATE TABLE work_logs (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'blocked', 'backlog')),
      priority TEXT CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high')),
      start_date TEXT,
      due_date TEXT,
      actual_end_date TEXT,
      project_id TEXT,
      flags TEXT DEFAULT '[]',
      reported_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    INSERT INTO work_logs (
      id,
      date,
      content,
      status,
      priority,
      start_date,
      due_date,
      actual_end_date,
      project_id,
      flags,
      reported_at,
      created_at,
      updated_at
    )
    SELECT
      id,
      date,
      content,
      status,
      priority,
      start_date,
      due_date,
      actual_end_date,
      project_id,
      COALESCE(flags, '[]'),
      reported_at,
      created_at,
      updated_at
    FROM work_logs_old;

    DROP TABLE work_logs_old;

    CREATE INDEX IF NOT EXISTS idx_work_logs_date ON work_logs(date);
    CREATE INDEX IF NOT EXISTS idx_work_logs_project ON work_logs(project_id);
    CREATE INDEX IF NOT EXISTS idx_work_logs_status ON work_logs(status);
    CREATE INDEX IF NOT EXISTS idx_work_logs_reported_at ON work_logs(reported_at);

    CREATE TRIGGER IF NOT EXISTS trg_work_logs_set_updated_at
    AFTER UPDATE ON work_logs
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE work_logs SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
    END;
  `);
};