import type Database from 'better-sqlite3';

export const id = '0026-create-checklist-templates';

export const up = async (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS checklist_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_by_email TEXT,
      updated_by_email TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS checklist_template_versions (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
      version_label TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      xlsx_blob BLOB NOT NULL,
      mapping_json TEXT,
      mapping_status TEXT NOT NULL DEFAULT 'pending' CHECK (mapping_status IN ('pending', 'parsed', 'failed')),
      is_active INTEGER NOT NULL DEFAULT 0,
      uploaded_by_email TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_templates_one_active
      ON checklist_templates(is_active)
      WHERE is_active = 1;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_template_versions_one_active
      ON checklist_template_versions(template_id, is_active)
      WHERE is_active = 1;

    CREATE INDEX IF NOT EXISTS idx_checklist_template_versions_template
      ON checklist_template_versions(template_id);

    CREATE INDEX IF NOT EXISTS idx_checklist_template_versions_checksum
      ON checklist_template_versions(checksum_sha256);

    CREATE TRIGGER IF NOT EXISTS trg_checklist_templates_set_updated_at
    AFTER UPDATE ON checklist_templates
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE checklist_templates
      SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = OLD.id;
    END;
  `);
};