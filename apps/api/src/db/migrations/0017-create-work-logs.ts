import type Database from 'better-sqlite3';

export const id = '0017-create-work-logs';

export const up = async (db: Database.Database) => {
  db.exec(`
    -- Work logs table (local/private data for personal productivity tracking)
    CREATE TABLE IF NOT EXISTS work_logs (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'blocked')),
      priority TEXT CHECK (priority IS NULL OR priority IN ('low', 'medium', 'high')),
      
      -- Task Planning Fields
      start_date TEXT,
      due_date TEXT,
      actual_end_date TEXT,
      
      -- Relations (placeholder for future Personal Projects feature)
      project_id TEXT,
      
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    -- Index for date-based queries (weekly view, etc.)
    CREATE INDEX IF NOT EXISTS idx_work_logs_date ON work_logs(date);

    -- Index for project-based queries
    CREATE INDEX IF NOT EXISTS idx_work_logs_project ON work_logs(project_id);

    -- Index for status-based queries (focus mode, rollover)
    CREATE INDEX IF NOT EXISTS idx_work_logs_status ON work_logs(status);

    -- Trigger to auto-update updated_at timestamp
    CREATE TRIGGER IF NOT EXISTS trg_work_logs_set_updated_at
    AFTER UPDATE ON work_logs
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE work_logs SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
    END;
  `);
};
