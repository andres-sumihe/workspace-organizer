import type Database from 'better-sqlite3';

export const id = '0027-create-project-checklists';

export const up = async (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_checklists (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES personal_projects(id) ON DELETE CASCADE,
      template_id TEXT NOT NULL REFERENCES checklist_templates(id) ON DELETE RESTRICT,
      template_version_id TEXT NOT NULL REFERENCES checklist_template_versions(id) ON DELETE RESTRICT,
      title TEXT NOT NULL,
      created_by_email TEXT,
      updated_by_email TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS project_checklist_sections (
      id TEXT PRIMARY KEY,
      checklist_id TEXT NOT NULL REFERENCES project_checklists(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS project_checklist_items (
      id TEXT PRIMARY KEY,
      checklist_id TEXT NOT NULL REFERENCES project_checklists(id) ON DELETE CASCADE,
      section_id TEXT NOT NULL REFERENCES project_checklist_sections(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'not_applicable')),
      owner TEXT,
      notes TEXT,
      evidence_url TEXT,
      completed_by_email TEXT,
      completed_at TEXT,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_project_checklists_project
      ON project_checklists(project_id);

    CREATE INDEX IF NOT EXISTS idx_project_checklist_sections_checklist
      ON project_checklist_sections(checklist_id, sort_order);

    CREATE INDEX IF NOT EXISTS idx_project_checklist_items_checklist
      ON project_checklist_items(checklist_id, sort_order);

    CREATE INDEX IF NOT EXISTS idx_project_checklist_items_section
      ON project_checklist_items(section_id, sort_order);

    CREATE TRIGGER IF NOT EXISTS trg_project_checklists_set_updated_at
    AFTER UPDATE ON project_checklists
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE project_checklists
      SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS trg_project_checklist_items_set_updated_at
    AFTER UPDATE ON project_checklist_items
    FOR EACH ROW
    WHEN NEW.updated_at <= OLD.updated_at
    BEGIN
      UPDATE project_checklist_items
      SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      WHERE id = OLD.id;
    END;
  `);
};