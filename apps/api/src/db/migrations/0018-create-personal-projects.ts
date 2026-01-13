import type Database from 'better-sqlite3';

export const id = '0018-create-personal-projects';

export const up = async (db: Database.Database) => {
  db.exec(`
    -- Personal projects table for tracking initiatives/undertakings
    CREATE TABLE IF NOT EXISTS personal_projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      
      -- Status derived from dates, but can also be explicit
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'archived')),
      
      -- Planning Data
      start_date TEXT,
      due_date TEXT,
      actual_end_date TEXT,
      
      -- Business Metadata
      business_proposal_id TEXT,
      change_id TEXT,
      
      -- Content
      notes TEXT,
      
      -- Relations
      workspace_id TEXT,
      
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
    );

    -- Index for workspace-based queries
    CREATE INDEX IF NOT EXISTS idx_personal_projects_workspace ON personal_projects(workspace_id);

    -- Index for status-based queries
    CREATE INDEX IF NOT EXISTS idx_personal_projects_status ON personal_projects(status);

    -- Trigger to auto-update updated_at timestamp
    CREATE TRIGGER IF NOT EXISTS trg_personal_projects_set_updated_at
    AFTER UPDATE ON personal_projects
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE personal_projects SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
    END;

    -- Add foreign key reference from work_logs to personal_projects
    -- SQLite doesn't support adding FK constraints to existing tables, 
    -- so we just ensure the relationship is understood at application level
  `);
};

export const down = async (db: Database.Database) => {
  db.exec(`
    DROP TRIGGER IF EXISTS trg_personal_projects_set_updated_at;
    DROP INDEX IF EXISTS idx_personal_projects_status;
    DROP INDEX IF EXISTS idx_personal_projects_workspace;
    DROP TABLE IF EXISTS personal_projects;
  `);
};
