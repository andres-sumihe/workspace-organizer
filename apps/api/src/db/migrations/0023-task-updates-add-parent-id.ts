import type Database from 'better-sqlite3';

export const id = '0023-task-updates-add-parent-id';

export const up = async (db: Database.Database) => {
  db.exec(`
    -- Add parent_id column for nested replies
    ALTER TABLE task_updates ADD COLUMN parent_id TEXT REFERENCES task_updates(id) ON DELETE CASCADE;

    -- Index for parent-child queries (finding replies)
    CREATE INDEX IF NOT EXISTS idx_task_updates_parent ON task_updates(parent_id);
  `);
};
