import type Database from 'better-sqlite3';

export const id = '0019-create-notes-credentials';

export const up = async (db: Database.Database) => {
  db.exec(`
    -- Notes table for storing markdown/text notes
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      is_pinned INTEGER DEFAULT 0 CHECK (is_pinned IN (0, 1)),
      project_id TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (project_id) REFERENCES personal_projects(id) ON DELETE SET NULL
    );

    -- Index for project-based queries
    CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(project_id);

    -- Index for pinned notes
    CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned);

    -- Trigger to auto-update updated_at timestamp
    CREATE TRIGGER IF NOT EXISTS trg_notes_set_updated_at
    AFTER UPDATE ON notes
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE notes SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
    END;

    -- Credentials/Vault table for encrypted secrets
    -- encrypted_blob contains encrypted JSON: { username, password, notes, fields }
    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT DEFAULT 'generic' CHECK (type IN ('password', 'api_key', 'ssh', 'database', 'generic')),
      encrypted_blob TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      project_id TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (project_id) REFERENCES personal_projects(id) ON DELETE SET NULL
    );

    -- Index for project-based queries
    CREATE INDEX IF NOT EXISTS idx_credentials_project ON credentials(project_id);

    -- Index for type-based queries
    CREATE INDEX IF NOT EXISTS idx_credentials_type ON credentials(type);

    -- Trigger to auto-update updated_at timestamp
    CREATE TRIGGER IF NOT EXISTS trg_credentials_set_updated_at
    AFTER UPDATE ON credentials
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE credentials SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
    END;

    -- Vault settings table for storing vault configuration
    CREATE TABLE IF NOT EXISTS vault_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);
};

export const down = async (db: Database.Database) => {
  db.exec(`
    DROP TABLE IF EXISTS vault_settings;
    DROP TRIGGER IF EXISTS trg_credentials_set_updated_at;
    DROP INDEX IF EXISTS idx_credentials_type;
    DROP INDEX IF EXISTS idx_credentials_project;
    DROP TABLE IF EXISTS credentials;
    DROP TRIGGER IF EXISTS trg_notes_set_updated_at;
    DROP INDEX IF EXISTS idx_notes_pinned;
    DROP INDEX IF EXISTS idx_notes_project;
    DROP TABLE IF EXISTS notes;
  `);
};
