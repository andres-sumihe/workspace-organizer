import type Database from 'better-sqlite3';

export const id = '0022-create-task-updates';

export const up = async (db: Database.Database) => {
  db.exec(`
    -- Task updates table (polymorphic progress notes for tasks)
    CREATE TABLE IF NOT EXISTS task_updates (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('work_log', 'personal_project')),
      entity_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    -- Index for entity-based queries
    CREATE INDEX IF NOT EXISTS idx_task_updates_entity ON task_updates(entity_type, entity_id);

    -- Trigger to auto-update updated_at timestamp
    CREATE TRIGGER IF NOT EXISTS trg_task_updates_set_updated_at
    AFTER UPDATE ON task_updates
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE task_updates SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
    END;

    -- Add flags column to work_logs table
    ALTER TABLE work_logs ADD COLUMN flags TEXT DEFAULT '[]';
  `);
};
