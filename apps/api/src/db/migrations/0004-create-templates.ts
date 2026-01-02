import type Database from 'better-sqlite3';

export const id = '0004-create-templates';

export const up = async (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(name)
    );

    CREATE TABLE IF NOT EXISTS template_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS template_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      content TEXT NOT NULL,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS template_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id TEXT NOT NULL,
      key TEXT NOT NULL,
      label TEXT NOT NULL,
      default_value TEXT,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workspace_templates (
      workspace_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      PRIMARY KEY (workspace_id, template_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_template_folders_template_id ON template_folders(template_id);
    CREATE INDEX IF NOT EXISTS idx_template_files_template_id ON template_files(template_id);
    CREATE INDEX IF NOT EXISTS idx_template_tokens_template_id ON template_tokens(template_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_templates_workspace_id ON workspace_templates(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_templates_template_id ON workspace_templates(template_id);
  `);
};



