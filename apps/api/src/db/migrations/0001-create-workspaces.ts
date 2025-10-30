import type { Database } from 'sqlite';

export const id = '0001-create-workspaces';

export const up = async (db: Database) => {
  // Ensure foreign keys behavior is enabled
  await db.exec(`PRAGMA foreign_keys = ON;`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL
    )
  `);

  // Workspaces table with sensible defaults for timestamps
  await db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      application TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'offline',
      project_count INTEGER NOT NULL DEFAULT 0,
      template_count INTEGER NOT NULL DEFAULT 0,
      last_indexed_at TEXT NOT NULL,
      root_path TEXT NOT NULL,
      description TEXT,
      settings_json TEXT NOT NULL DEFAULT ('{}'),
      statistics_json TEXT NOT NULL DEFAULT ('{}'),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);

  // Applications table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      project_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(name)
    )
  `);

  // Projects table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      pic_development TEXT,
      pic_uat TEXT,
      workspace_id TEXT NOT NULL,
      application_id TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL
    )
  `);

  // Triggers to keep updated_at current on update operations
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_workspaces_set_updated_at
    AFTER UPDATE ON workspaces
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE workspaces SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
    END;
  `);

  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_applications_set_updated_at
    AFTER UPDATE ON applications
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE applications SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
    END;
  `);

  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_projects_set_updated_at
    AFTER UPDATE ON projects
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE projects SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
    END;
  `);

  // Indexes for common queries
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_workspaces_name ON workspaces(name);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_workspaces_application ON workspaces(application);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_workspaces_last_indexed_at ON workspaces(last_indexed_at);`);

  // Unique constraint for root_path
  await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_workspaces_root_path ON workspaces(root_path);`);

  // Note: Seed data removed. The application no longer inserts sample workspaces
  // automatically. Workspaces should be created via the API or application UI.
};
