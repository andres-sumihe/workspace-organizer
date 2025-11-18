import type { Database } from 'sqlite';

export const id = '0003-create-scripts';

export const up = async (db: Database) => {
  await db.exec(`PRAGMA foreign_keys = ON;`);

  // Scripts table - core metadata for batch scripts
  await db.exec(`
    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      file_path TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'batch',
      is_active INTEGER NOT NULL DEFAULT 1,
      has_credentials INTEGER NOT NULL DEFAULT 0,
      execution_count INTEGER NOT NULL DEFAULT 0,
      last_executed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);

  // Drive mappings extracted from scripts
  await db.exec(`
    CREATE TABLE IF NOT EXISTS drive_mappings (
      id TEXT PRIMARY KEY,
      script_id TEXT NOT NULL,
      drive_letter TEXT NOT NULL,
      network_path TEXT NOT NULL,
      server_name TEXT,
      share_name TEXT,
      has_credentials INTEGER NOT NULL DEFAULT 0,
      username TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
    )
  `);

  // Tags for organizing scripts
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(name)
    )
  `);

  // Many-to-many relationship between scripts and tags
  await db.exec(`
    CREATE TABLE IF NOT EXISTS script_tags (
      script_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      PRIMARY KEY (script_id, tag_id),
      FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  // Script dependencies (e.g., script A calls script B)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS script_dependencies (
      dependent_script_id TEXT NOT NULL,
      dependency_script_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      PRIMARY KEY (dependent_script_id, dependency_script_id),
      FOREIGN KEY (dependent_script_id) REFERENCES scripts(id) ON DELETE CASCADE,
      FOREIGN KEY (dependency_script_id) REFERENCES scripts(id) ON DELETE CASCADE
    )
  `);

  // Triggers to keep updated_at current
  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_scripts_set_updated_at
    AFTER UPDATE ON scripts
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE scripts SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
    END;
  `);

  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_drive_mappings_set_updated_at
    AFTER UPDATE ON drive_mappings
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE drive_mappings SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
    END;
  `);

  await db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_tags_set_updated_at
    AFTER UPDATE ON tags
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE tags SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
    END;
  `);

  // Indexes for efficient queries
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_scripts_type ON scripts(type);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_scripts_is_active ON scripts(is_active);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_scripts_name ON scripts(name);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_drive_mappings_drive_letter ON drive_mappings(drive_letter);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_drive_mappings_script_id ON drive_mappings(script_id);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_script_tags_script_id ON script_tags(script_id);`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_script_tags_tag_id ON script_tags(tag_id);`);

  // Unique constraint for file paths to prevent duplicate imports
  await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_scripts_file_path ON scripts(file_path);`);
};
