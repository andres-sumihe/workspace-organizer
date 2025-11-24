# Database Schema Documentation

## Overview

The Workspace Organizer application uses **SQLite** as its primary database engine. The schema is organized around three main domains:

1. **Workspace Management** - Workspaces, applications, and projects
2. **Script Management** - Batch scripts, drive mappings, and dependencies
3. **Metadata & System** - Migrations tracking

All tables use **TEXT** primary keys (UUIDs) for cross-platform compatibility and include automatic timestamp management via triggers.

---

## Schema Version

**Current Version:** 0003 (Scripts Support)

**Migration History:**
- `0001-create-workspaces` - Initial workspace, application, and project tables
- `0002-add-project-relative-path` - Added relative path tracking for projects
- `0003-create-scripts` - Batch script management with drive mappings and tags

---

## Domain 1: Workspace Management

### Table: `workspaces`

Represents physical workspace directories containing projects and templates.

#### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique workspace identifier (UUID) |
| `name` | TEXT | NOT NULL | Display name for the workspace |
| `status` | TEXT | NOT NULL, DEFAULT 'offline' | Health status: 'healthy', 'degraded', 'offline' |
| `project_count` | INTEGER | NOT NULL, DEFAULT 0 | Cached count of projects in workspace |
| `template_count` | INTEGER | NOT NULL, DEFAULT 0 | Cached count of templates in workspace |
| `last_indexed_at` | TEXT | NOT NULL | ISO 8601 timestamp of last scan |
| `root_path` | TEXT | NOT NULL, UNIQUE | Absolute filesystem path to workspace root |
| `description` | TEXT | NULL | Optional workspace description |
| `settings_json` | TEXT | NOT NULL, DEFAULT '{}' | JSON object storing workspace settings |
| `statistics_json` | TEXT | NOT NULL, DEFAULT '{}' | JSON object storing workspace statistics |
| `created_at` | TEXT | NOT NULL, AUTO | ISO 8601 creation timestamp |
| `updated_at` | TEXT | NOT NULL, AUTO | ISO 8601 last update timestamp |

#### Indexes

- `idx_workspaces_name` - B-tree index on `name` for search queries
- `idx_workspaces_status` - B-tree index on `status` for filtering
- `idx_workspaces_last_indexed_at` - B-tree index on `last_indexed_at` for sorting
- `ux_workspaces_root_path` - Unique index on `root_path` to prevent duplicates

#### Triggers

- `trg_workspaces_set_updated_at` - Automatically updates `updated_at` on row modification

#### Business Rules

- `root_path` must be unique across all workspaces
- `status` is validated at application level (not CHECK constraint in current version)
- `settings_json` and `statistics_json` are stored as JSON strings and parsed by application
- Deletion cascades to all related projects

#### Example JSON Fields

**settings_json:**
```json
{
  "enforceNamingRules": true,
  "autoIndex": false,
  "indexingInterval": 3600
}
```

**statistics_json:**
```json
{
  "totalFiles": 1250,
  "totalSize": 524288000,
  "lastScanDuration": 2340
}
```

---

### Table: `applications`

Represents logical groupings of projects (e.g., "CRM System", "API Gateway").

#### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique application identifier (UUID) |
| `name` | TEXT | NOT NULL, UNIQUE | Application name |
| `description` | TEXT | NULL | Optional application description |
| `project_count` | INTEGER | NOT NULL, DEFAULT 0 | Cached count of projects using this application |
| `created_at` | TEXT | NOT NULL, AUTO | ISO 8601 creation timestamp |
| `updated_at` | TEXT | NOT NULL, AUTO | ISO 8601 last update timestamp |

#### Indexes

- Unique constraint on `name` ensures no duplicate application names

#### Triggers

- `trg_applications_set_updated_at` - Automatically updates `updated_at` on row modification

#### Business Rules

- Application names must be unique across the system
- Deleting an application sets `application_id` to NULL in related projects (ON DELETE SET NULL)
- `project_count` is a denormalized counter for performance

---

### Table: `projects`

Represents individual projects within workspaces, optionally linked to applications.

#### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique project identifier (UUID) |
| `name` | TEXT | NOT NULL | Project display name |
| `description` | TEXT | NULL | Optional project description |
| `pic_development` | TEXT | NULL | Person-in-charge for development |
| `pic_uat` | TEXT | NULL | Person-in-charge for UAT |
| `workspace_id` | TEXT | NOT NULL, FK | Foreign key to `workspaces.id` |
| `application_id` | TEXT | NULL, FK | Foreign key to `applications.id` |
| `relative_path` | TEXT | NOT NULL, DEFAULT '' | Path relative to workspace root |
| `created_at` | TEXT | NOT NULL, AUTO | ISO 8601 creation timestamp |
| `updated_at` | TEXT | NOT NULL, AUTO | ISO 8601 last update timestamp |

#### Indexes

- `idx_projects_workspace` - B-tree index on `workspace_id` for workspace-scoped queries

#### Triggers

- `trg_projects_set_updated_at` - Automatically updates `updated_at` on row modification

#### Foreign Keys

- `workspace_id` → `workspaces.id` (ON DELETE CASCADE)
- `application_id` → `applications.id` (ON DELETE SET NULL)

#### Business Rules

- Projects are always owned by exactly one workspace
- Deleting a workspace deletes all its projects
- Projects can optionally belong to an application for logical grouping
- `relative_path` added in migration 0002 to track project location within workspace

---

## Domain 2: Script Management

### Table: `scripts`

Stores batch scripts with metadata for organization and analysis.

#### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique script identifier (UUID) |
| `name` | TEXT | NOT NULL | Script display name |
| `description` | TEXT | NULL | Optional script description |
| `file_path` | TEXT | NOT NULL, UNIQUE | Absolute path to script file on filesystem |
| `content` | TEXT | NOT NULL | Full text content of the script |
| `type` | TEXT | NOT NULL, DEFAULT 'batch' | Script type: 'batch', 'powershell', 'shell', 'other' |
| `is_active` | INTEGER | NOT NULL, DEFAULT 1 | Active flag (1 = active, 0 = inactive) |
| `has_credentials` | INTEGER | NOT NULL, DEFAULT 0 | Flag indicating presence of credentials (1 = yes, 0 = no) |
| `execution_count` | INTEGER | NOT NULL, DEFAULT 0 | Number of times script has been executed |
| `last_executed_at` | TEXT | NULL | ISO 8601 timestamp of last execution |
| `created_at` | TEXT | NOT NULL, AUTO | ISO 8601 creation timestamp |
| `updated_at` | TEXT | NOT NULL, AUTO | ISO 8601 last update timestamp |

#### Indexes

- `idx_scripts_type` - B-tree index on `type` for filtering by script type
- `idx_scripts_is_active` - B-tree index on `is_active` for active/inactive filtering
- `idx_scripts_name` - B-tree index on `name` for search queries
- `ux_scripts_file_path` - Unique index on `file_path` to prevent duplicate imports

#### Triggers

- `trg_scripts_set_updated_at` - Automatically updates `updated_at` on row modification

#### Business Rules

- `file_path` must be unique to prevent duplicate script imports
- `type` is validated at application level
- `is_active` uses INTEGER for SQLite boolean representation (0/1)
- `has_credentials` is set by script analyzer detecting username/password patterns
- Script deletion cascades to related drive mappings, tags, and dependencies

---

### Table: `drive_mappings`

Stores network drive mapping information extracted from scripts.

#### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique mapping identifier (UUID) |
| `script_id` | TEXT | NOT NULL, FK | Foreign key to `scripts.id` |
| `drive_letter` | TEXT | NOT NULL | Drive letter (e.g., 'Z:', 'Y:') |
| `network_path` | TEXT | NOT NULL | UNC path (e.g., '\\\\server\\share') |
| `server_name` | TEXT | NULL | Extracted server name from UNC path |
| `share_name` | TEXT | NULL | Extracted share name from UNC path |
| `has_credentials` | INTEGER | NOT NULL, DEFAULT 0 | Flag indicating inline credentials (1 = yes, 0 = no) |
| `username` | TEXT | NULL | Username if detected in script |
| `created_at` | TEXT | NOT NULL, AUTO | ISO 8601 creation timestamp |
| `updated_at` | TEXT | NOT NULL, AUTO | ISO 8601 last update timestamp |

#### Indexes

- `idx_drive_mappings_drive_letter` - B-tree index on `drive_letter` for conflict detection
- `idx_drive_mappings_script_id` - B-tree index on `script_id` for script-scoped queries

#### Triggers

- `trg_drive_mappings_set_updated_at` - Automatically updates `updated_at` on row modification

#### Foreign Keys

- `script_id` → `scripts.id` (ON DELETE CASCADE)

#### Business Rules

- Multiple drive mappings can exist per script
- Drive letter conflicts are detected at application level (same letter → different paths)
- Passwords are never stored; only presence is flagged via `has_credentials`
- Deleting a script deletes all its drive mappings

---

### Table: `tags`

Stores tags for categorizing and organizing scripts.

#### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Unique tag identifier (UUID) |
| `name` | TEXT | NOT NULL, UNIQUE | Tag name |
| `color` | TEXT | NULL | Optional color hex code (e.g., '#3b82f6') |
| `created_at` | TEXT | NOT NULL, AUTO | ISO 8601 creation timestamp |
| `updated_at` | TEXT | NOT NULL, AUTO | ISO 8601 last update timestamp |

#### Triggers

- `trg_tags_set_updated_at` - Automatically updates `updated_at` on row modification

#### Business Rules

- Tag names must be unique across the system
- Tags are reusable across multiple scripts via `script_tags` junction table
- Deleting a tag removes all script associations

---

### Table: `script_tags`

Junction table for many-to-many relationship between scripts and tags.

#### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `script_id` | TEXT | NOT NULL, FK, PK | Foreign key to `scripts.id` |
| `tag_id` | TEXT | NOT NULL, FK, PK | Foreign key to `tags.id` |
| `created_at` | TEXT | NOT NULL, AUTO | ISO 8601 creation timestamp |

#### Indexes

- `idx_script_tags_script_id` - B-tree index on `script_id` for script → tags queries
- `idx_script_tags_tag_id` - B-tree index on `tag_id` for tag → scripts queries

#### Foreign Keys

- `script_id` → `scripts.id` (ON DELETE CASCADE)
- `tag_id` → `tags.id` (ON DELETE CASCADE)

#### Business Rules

- Composite primary key `(script_id, tag_id)` prevents duplicate associations
- Deleting either script or tag removes the association

---

### Table: `script_dependencies`

Tracks dependencies between scripts (e.g., script A calls script B).

#### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `dependent_script_id` | TEXT | NOT NULL, FK, PK | Script that depends on another |
| `dependency_script_id` | TEXT | NOT NULL, FK, PK | Script being depended upon |
| `created_at` | TEXT | NOT NULL, AUTO | ISO 8601 creation timestamp |

#### Foreign Keys

- `dependent_script_id` → `scripts.id` (ON DELETE CASCADE)
- `dependency_script_id` → `scripts.id` (ON DELETE CASCADE)

#### Business Rules

- Composite primary key `(dependent_script_id, dependency_script_id)` prevents duplicate dependencies
- Circular dependencies are allowed at database level but may be validated at application level
- Deleting a script removes all its dependency relationships (both incoming and outgoing)

---

## Domain 3: System Metadata

### Table: `migrations`

Tracks applied database migrations to prevent re-execution.

#### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | Migration identifier (e.g., '0001-create-workspaces') |
| `executed_at` | TEXT | NOT NULL | ISO 8601 timestamp when migration was applied |

#### Business Rules

- Each migration runs exactly once
- Migration IDs are sequential for ordering
- Migration system is implemented in `apps/api/src/db/migrations/index.ts`

---

## Data Types & Conventions

### Primary Keys

- All primary keys use **TEXT** type with UUID values (generated via `uuid` package)
- Format: lowercase UUID v4 (e.g., `'550e8400-e29b-41d4-a716-446655440000'`)

### Timestamps

- All timestamps use **TEXT** type in ISO 8601 format with fractional seconds and UTC timezone
- Format: `YYYY-MM-DDTHH:MM:SS.sssZ` (e.g., `'2025-11-19T14:30:45.123Z'`)
- Generated via SQLite: `strftime('%Y-%m-%dT%H:%M:%fZ','now')`
- Automatic management via `DEFAULT` clause on `created_at` and triggers on `updated_at`

### Booleans

- SQLite has no native boolean type; uses **INTEGER** with values `0` (false) or `1` (true)
- Examples: `is_active`, `has_credentials`

### JSON Fields

- Stored as **TEXT** type containing serialized JSON
- Parsed/stringified at application level
- Examples: `settings_json`, `statistics_json`
- SQLite JSON1 extension available for queries: `json_extract(settings_json, '$.key')`

### Foreign Keys

- All foreign key constraints use `ON DELETE CASCADE` or `ON DELETE SET NULL` for referential integrity
- Foreign keys are enabled globally via `PRAGMA foreign_keys = ON;`

---

## Triggers

### Automatic Timestamp Updates

Every table with an `updated_at` column has a trigger that automatically updates the timestamp when rows are modified:

```sql
CREATE TRIGGER IF NOT EXISTS trg_<table>_set_updated_at
AFTER UPDATE ON <table>
FOR EACH ROW
WHEN NEW.updated_at <= OLD.updated_at
BEGIN
  UPDATE <table> SET updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id = OLD.id;
END;
```

**Active Triggers:**
- `trg_workspaces_set_updated_at`
- `trg_applications_set_updated_at`
- `trg_projects_set_updated_at`
- `trg_scripts_set_updated_at`
- `trg_drive_mappings_set_updated_at`
- `trg_tags_set_updated_at`

---

## Indexes & Performance

### Index Strategy

1. **Primary Keys** - Automatic B-tree index for fast lookups
2. **Foreign Keys** - Explicit indexes on FK columns for join performance
3. **Filter Columns** - Indexes on frequently filtered columns (`status`, `type`, `is_active`)
4. **Search Columns** - Indexes on text columns used in search queries (`name`)
5. **Sort Columns** - Indexes on columns used in ORDER BY clauses (`last_indexed_at`)

### Unique Constraints

- Enforced via **UNIQUE INDEX** for better control and explicit naming
- Examples: `ux_workspaces_root_path`, `ux_scripts_file_path`

### Query Optimization

- Denormalized counters (`project_count`, `template_count`) avoid expensive COUNT queries
- Indexed foreign keys enable efficient JOIN operations
- Composite indexes on junction tables optimize many-to-many queries

---

## Relationships Diagram

```
workspaces (1) ───< (N) projects (N) >─── (1) applications
                                           (optional)

scripts (1) ───< (N) drive_mappings

scripts (N) >───< (N) tags
              (via script_tags)

scripts (N) >───< (N) scripts
              (via script_dependencies)
```

---

## Migration System

### Location

`apps/api/src/db/migrations/`

### Execution

Migrations run automatically on application startup via `apps/api/src/db/client.ts`.

### Adding New Migrations

1. Create new file: `000X-description.ts`
2. Export `id` (string) and `up` (async function)
3. Import in `migrations/index.ts`
4. Restart API server to apply

### Example Migration

```typescript
import type { Database } from 'sqlite';

export const id = '0004-add-new-feature';

export const up = async (db: Database) => {
  await db.exec(`
    ALTER TABLE scripts
    ADD COLUMN new_column TEXT
  `);
};
```

---

## Database File Location

- **Development**: `apps/api/data/workspace-organizer.db`
- **Production**: Configurable via environment (TBD)

---

## Backup & Maintenance

### Recommended Practices

1. **Regular Backups**: SQLite file can be copied while database is running (using `.backup` command or file copy)
2. **VACUUM**: Run periodically to reclaim space after deletions
3. **ANALYZE**: Update query planner statistics for optimal performance
4. **Integrity Check**: `PRAGMA integrity_check;` to detect corruption

### Example Maintenance Commands

```sql
-- Reclaim space
VACUUM;

-- Update statistics
ANALYZE;

-- Check integrity
PRAGMA integrity_check;

-- Show indexes
SELECT * FROM sqlite_master WHERE type = 'index';
```

---

## Security Considerations

1. **No Raw Passwords**: Credentials detected in scripts are flagged but never stored
2. **Parameterized Queries**: All database access uses prepared statements (via repositories)
3. **Foreign Keys Enabled**: Prevents orphaned records and maintains referential integrity
4. **Input Validation**: Performed at service layer before database operations

---

## Future Enhancements

### Planned Features

- **Full-Text Search**: FTS5 virtual table for workspace/script search
- **Audit Logging**: Track user actions and data changes
- **Soft Deletes**: `deleted_at` column with filtered queries
- **Version History**: Track script content changes over time

### Schema Evolution

- All schema changes go through migration system
- Backwards compatibility maintained where possible
- Breaking changes documented in migration comments

---

## References

- SQLite Documentation: https://www.sqlite.org/docs.html
- Migration Files: `apps/api/src/db/migrations/`
- Repository Layer: `apps/api/src/repositories/`
- Database Client: `apps/api/src/db/client.ts`
