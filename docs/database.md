PRAGMA foreign_keys = ON;

-- 1) Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('healthy','degraded','offline')),
	project_count INTEGER NOT NULL DEFAULT 0,
	template_count INTEGER NOT NULL DEFAULT 0,
	last_indexed_at TEXT NOT NULL,
	root_path TEXT NOT NULL,
	description TEXT,
	settings_json TEXT NOT NULL,
	statistics_json TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

-- 2) Applications
CREATE TABLE IF NOT EXISTS applications (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	description TEXT,
	project_count INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	UNIQUE(name)
);

-- 3) Projects
CREATE TABLE IF NOT EXISTS projects (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	description TEXT,
	pic_development TEXT,
	pic_uat TEXT,
	workspace_id TEXT NOT NULL,
	application_id TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
	FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_name ON workspaces(name);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);

-- Apply recommendations
-- 1) Use defaults for timestamps so created_at/updated_at are set automatically
-- (If creating tables from scratch, include DEFAULT expressions as below.)

/* Example CREATE TABLE (workspaces) with timestamp defaults (if you recreate the table):
CREATE TABLE workspaces (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	-- application removed: applications are managed in their own table
	status TEXT NOT NULL CHECK (status IN ('healthy','degraded','offline')),
	project_count INTEGER NOT NULL DEFAULT 0,
	template_count INTEGER NOT NULL DEFAULT 0,
	last_indexed_at TEXT NOT NULL,
	root_path TEXT NOT NULL,
	description TEXT,
	settings_json TEXT NOT NULL,
	statistics_json TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
*/

-- 2) Trigger to keep updated_at in sync for workspaces
CREATE TRIGGER IF NOT EXISTS trg_workspaces_set_updated_at
AFTER UPDATE ON workspaces
FOR EACH ROW
WHEN NEW.updated_at <= OLD.updated_at
BEGIN
	UPDATE workspaces SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
END;

-- 3) Trigger to keep updated_at in sync for applications
CREATE TRIGGER IF NOT EXISTS trg_applications_set_updated_at
AFTER UPDATE ON applications
FOR EACH ROW
WHEN NEW.updated_at <= OLD.updated_at
BEGIN
	UPDATE applications SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
END;

-- 4) Trigger to keep updated_at in sync for projects
CREATE TRIGGER IF NOT EXISTS trg_projects_set_updated_at
AFTER UPDATE ON projects
FOR EACH ROW
WHEN NEW.updated_at <= OLD.updated_at
BEGIN
	UPDATE projects SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
END;

-- 5) Additional useful indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON workspaces(status);
CREATE INDEX IF NOT EXISTS idx_workspaces_last_indexed_at ON workspaces(last_indexed_at);

-- 6) Enforce uniqueness where appropriate (e.g. root_path)
CREATE UNIQUE INDEX IF NOT EXISTS ux_workspaces_root_path ON workspaces(root_path);

-- 7) JSON usage note (JSON1 functions are available on most SQLite builds)
-- Example JSON query:
--   SELECT json_extract(settings_json, '$.enforceNamingRules') FROM workspaces WHERE id = ?;

-- 8) FTS example (optional): create an FTS5 virtual table for full-text search on workspace name/description
--CREATE VIRTUAL TABLE IF NOT EXISTS workspaces_fts USING fts5(name, description, content='workspaces', content_rowid='rowid');




