import type { Database } from 'sqlite';

export const id = '0001-create-workspaces';

export const up = async (db: Database) => {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      application TEXT NOT NULL,
      team TEXT NOT NULL,
      status TEXT NOT NULL,
      project_count INTEGER NOT NULL DEFAULT 0,
      template_count INTEGER NOT NULL DEFAULT 0,
      last_indexed_at TEXT NOT NULL,
      root_path TEXT NOT NULL,
      description TEXT,
      settings_json TEXT NOT NULL,
      statistics_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Note: Seed data removed. The application no longer inserts sample workspaces
  // automatically. Workspaces should be created via the API or application UI.
};
