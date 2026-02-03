/**
 * Static SQL exports for DBA execution.
 *
 * These SQL scripts are extracted from the TypeScript migrations
 * and can be copied directly by DBAs for manual execution.
 *
 * SCHEMA: workspace_organizer
 *
 * WORKFLOW:
 * - DBAs run the unified schema script to create/upgrade the schema
 * - Users connect to the pre-configured database
 * - App validates schema version before allowing connection
 * - Users CANNOT modify schema - only DBAs can
 */

import { SCHEMA_VERSION, SHARED_SCHEMA } from '../shared-schema.js';

export interface MigrationSQL {
  id: string;
  description: string;
  sql: string;
}

// Schema setup with version tracking (run once before all migrations)
export const SCHEMA_SETUP_SQL = `
-- ============================================================
-- Workspace Organizer Schema Setup
-- ============================================================

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS workspace_organizer;

-- Set search path for this session
SET search_path TO workspace_organizer, public;

-- Create schema_info table for version tracking
CREATE TABLE IF NOT EXISTS workspace_organizer.schema_info (
  id SERIAL PRIMARY KEY,
  version INTEGER NOT NULL,
  app_version VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(255)
);

-- Create migrations tracking table (for audit purposes)
CREATE TABLE IF NOT EXISTS workspace_organizer.migrations (
  id VARCHAR(255) PRIMARY KEY,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  executed_by VARCHAR(255),
  hostname VARCHAR(255)
);
`;

// Schema version insert/update (appended to unified script)
export const getSchemaVersionSQL = (version: number): string => `
-- ============================================================
-- Schema Version: ${version}
-- ============================================================

-- Update or insert schema version
INSERT INTO workspace_organizer.schema_info (version, app_version, updated_by)
VALUES (${version}, 'manual', current_user)
ON CONFLICT (id) DO UPDATE SET
  version = ${version},
  updated_at = NOW(),
  updated_by = current_user;
`;

export const MIGRATION_SQLS: MigrationSQL[] = [
  {
    id: '0001-create-teams',
    description: 'Create teams and team_members tables',
    sql: `
-- Migration: 0001-create-teams
-- Description: Create teams and team_members tables

SET search_path TO workspace_organizer, public;

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT teams_name_unique UNIQUE (name)
);

-- Create trigger for teams updated_at
DROP TRIGGER IF EXISTS trg_teams_updated_at ON teams;
CREATE TRIGGER trg_teams_updated_at
BEFORE UPDATE ON teams
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT team_members_team_email_unique UNIQUE (team_id, email)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members (email);

-- Create trigger for team_members updated_at
DROP TRIGGER IF EXISTS trg_team_members_updated_at ON team_members;
CREATE TRIGGER trg_team_members_updated_at
BEFORE UPDATE ON team_members
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Record migration
INSERT INTO workspace_organizer.migrations (id, executed_by) VALUES ('0001-create-teams', current_user);
`
  },
  {
    id: '0002-create-audit-log',
    description: 'Create audit_log table for tracking changes',
    sql: `
-- Migration: 0002-create-audit-log
-- Description: Create audit_log table for tracking all changes

SET search_path TO workspace_organizer, public;

-- Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  member_email VARCHAR(255),
  member_display_name VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_log_team_id ON audit_log (team_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_member_email ON audit_log (member_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type ON audit_log (resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_id ON audit_log (resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_log_resource
ON audit_log (resource_type, resource_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_member_timestamp
ON audit_log (member_email, timestamp DESC);

-- Record migration
INSERT INTO workspace_organizer.migrations (id, executed_by) VALUES ('0002-create-audit-log', current_user);
`
  },
  {
    id: '0003-create-scripts',
    description: 'Create scripts, drive_mappings, and script_drive_mappings tables',
    sql: `
-- Migration: 0003-create-scripts
-- Description: Create scripts and related tables

SET search_path TO workspace_organizer, public;

-- Create scripts table
CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  file_path VARCHAR(1000),
  content TEXT,
  type VARCHAR(50) DEFAULT 'batch',
  is_active BOOLEAN DEFAULT true,
  tags TEXT[],
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trg_scripts_updated_at ON scripts;
CREATE TRIGGER trg_scripts_updated_at
BEFORE UPDATE ON scripts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_scripts_team ON scripts (team_id);
CREATE INDEX IF NOT EXISTS idx_scripts_name ON scripts (name);
CREATE INDEX IF NOT EXISTS idx_scripts_type ON scripts (type);
CREATE INDEX IF NOT EXISTS idx_scripts_is_active ON scripts (is_active);
CREATE INDEX IF NOT EXISTS idx_scripts_tags ON scripts USING GIN (tags);

-- Create drive_mappings table
CREATE TABLE IF NOT EXISTS drive_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  drive_letter CHAR(1) NOT NULL,
  unc_path VARCHAR(1000) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT drive_mappings_team_letter_unique UNIQUE (team_id, drive_letter)
);

-- Create trigger for drive_mappings updated_at
DROP TRIGGER IF EXISTS trg_drive_mappings_updated_at ON drive_mappings;
CREATE TRIGGER trg_drive_mappings_updated_at
BEFORE UPDATE ON drive_mappings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for drive_mappings
CREATE INDEX IF NOT EXISTS idx_drive_mappings_team ON drive_mappings (team_id);
CREATE INDEX IF NOT EXISTS idx_drive_mappings_letter ON drive_mappings (drive_letter);

-- Create script_drive_mappings junction table
CREATE TABLE IF NOT EXISTS script_drive_mappings (
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  drive_mapping_id UUID NOT NULL REFERENCES drive_mappings(id) ON DELETE CASCADE,
  PRIMARY KEY (script_id, drive_mapping_id)
);

-- Record migration
INSERT INTO workspace_organizer.migrations (id, executed_by) VALUES ('0003-create-scripts', current_user);
`
  },
  {
    id: '0004-create-controlm-jobs',
    description: 'Create Control-M jobs, dependencies, and conditions tables',
    sql: `
-- Migration: 0004-create-controlm-jobs
-- Description: Create Control-M job tracking tables

SET search_path TO workspace_organizer, public;

-- Create controlm_jobs table
CREATE TABLE IF NOT EXISTS controlm_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id INTEGER NOT NULL,
  application VARCHAR(255) NOT NULL,
  group_name VARCHAR(255) NOT NULL,
  mem_name VARCHAR(255),
  job_name VARCHAR(255) NOT NULL,
  description TEXT,
  node_id VARCHAR(255) NOT NULL,
  owner VARCHAR(255),
  task_type VARCHAR(50) DEFAULT 'Job',
  is_cyclic BOOLEAN DEFAULT false,
  priority VARCHAR(50),
  is_critical BOOLEAN DEFAULT false,
  days_calendar VARCHAR(255),
  weeks_calendar VARCHAR(255),
  from_time VARCHAR(10),
  to_time VARCHAR(10),
  interval_value VARCHAR(50),
  mem_lib VARCHAR(255),
  author VARCHAR(255),
  creation_user VARCHAR(255),
  creation_date VARCHAR(50),
  change_user_id VARCHAR(255),
  change_date VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  linked_script_id UUID REFERENCES scripts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trg_controlm_jobs_updated_at ON controlm_jobs;
CREATE TRIGGER trg_controlm_jobs_updated_at
BEFORE UPDATE ON controlm_jobs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_controlm_jobs_job_id ON controlm_jobs (job_id);
CREATE INDEX IF NOT EXISTS idx_controlm_jobs_application ON controlm_jobs (application);
CREATE INDEX IF NOT EXISTS idx_controlm_jobs_group ON controlm_jobs (group_name);
CREATE INDEX IF NOT EXISTS idx_controlm_jobs_name ON controlm_jobs (job_name);
CREATE INDEX IF NOT EXISTS idx_controlm_jobs_active ON controlm_jobs (is_active);
CREATE INDEX IF NOT EXISTS idx_controlm_jobs_script ON controlm_jobs (linked_script_id);

-- Create job_dependencies table
CREATE TABLE IF NOT EXISTS job_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  predecessor_job_id VARCHAR(255) NOT NULL,
  successor_job_id VARCHAR(255) NOT NULL,
  condition_type VARCHAR(50) DEFAULT 'OK',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create job_conditions table
CREATE TABLE IF NOT EXISTS job_conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id VARCHAR(255) NOT NULL,
  condition_name VARCHAR(255) NOT NULL,
  condition_type VARCHAR(50) NOT NULL,
  odate VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for dependencies and conditions
CREATE INDEX IF NOT EXISTS idx_job_dependencies_predecessor ON job_dependencies (predecessor_job_id);
CREATE INDEX IF NOT EXISTS idx_job_dependencies_successor ON job_dependencies (successor_job_id);
CREATE INDEX IF NOT EXISTS idx_job_conditions_job ON job_conditions (job_id);

-- Record migration
INSERT INTO workspace_organizer.migrations (id, executed_by) VALUES ('0004-create-controlm-jobs', current_user);
`
  },
  {
    id: '0005-create-app-info',
    description: 'Create app_info and app_secrets tables for team attestation',
    sql: `
-- Migration: 0005-create-app-info
-- Description: Create app identity and secrets tables

SET search_path TO workspace_organizer, public;

-- Public app identity
CREATE TABLE IF NOT EXISTS app_info (
  server_id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  team_name VARCHAR(255) NOT NULL,
  public_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for team lookups
CREATE INDEX IF NOT EXISTS idx_app_info_team ON app_info(team_id);

-- Secure secrets storage
CREATE TABLE IF NOT EXISTS app_secrets (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE app_secrets IS 'Secure storage for server secrets. Access should be restricted.';

-- Record migration
INSERT INTO workspace_organizer.migrations (id, executed_by) VALUES ('0005-create-app-info', current_user);
`
  },
  {
    id: '0006-create-tags',
    description: 'Create tags and script_tags tables',
    sql: `
-- Migration: 0006-create-tags
-- Description: Create tags management tables

SET search_path TO workspace_organizer, public;

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  color VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create trigger for tags updated_at
DROP TRIGGER IF EXISTS trg_tags_updated_at ON tags;
CREATE TRIGGER trg_tags_updated_at
BEFORE UPDATE ON tags
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create script_tags junction table
CREATE TABLE IF NOT EXISTS script_tags (
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (script_id, tag_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_script_tags_script ON script_tags (script_id);
CREATE INDEX IF NOT EXISTS idx_script_tags_tag ON script_tags (tag_id);

-- Record migration
INSERT INTO workspace_organizer.migrations (id, executed_by) VALUES ('0006-create-tags', current_user);
`
  },
  {
    id: '0007-update-drive-mappings',
    description: 'Update drive_mappings to script-child model',
    sql: `
-- Migration: 0007-update-drive-mappings
-- Description: Update drive_mappings schema to script-child model

SET search_path TO workspace_organizer, public;

-- Drop the junction table first
DROP TABLE IF EXISTS script_drive_mappings;

-- Drop the existing drive_mappings table
DROP TABLE IF EXISTS drive_mappings;

-- Recreate drive_mappings with the correct schema
CREATE TABLE drive_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  drive_letter VARCHAR(5) NOT NULL,
  network_path VARCHAR(1000) NOT NULL,
  server_name VARCHAR(255),
  share_name VARCHAR(255),
  has_credentials BOOLEAN DEFAULT false,
  username VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trg_drive_mappings_updated_at ON drive_mappings;
CREATE TRIGGER trg_drive_mappings_updated_at
BEFORE UPDATE ON drive_mappings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create indexes
CREATE INDEX idx_drive_mappings_script_id ON drive_mappings(script_id);
CREATE INDEX idx_drive_mappings_drive_letter ON drive_mappings(drive_letter);

-- Record migration
INSERT INTO workspace_organizer.migrations (id, executed_by) VALUES ('0007-update-drive-mappings', current_user);
`
  },
  {
    id: '0008-create-script-dependencies',
    description: 'Create script_dependencies table',
    sql: `
-- Migration: 0008-create-script-dependencies
-- Description: Create script dependencies tracking

SET search_path TO workspace_organizer, public;

CREATE TABLE IF NOT EXISTS script_dependencies (
  dependent_script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  dependency_script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dependent_script_id, dependency_script_id)
);

CREATE INDEX IF NOT EXISTS idx_script_dependencies_dependent ON script_dependencies(dependent_script_id);
CREATE INDEX IF NOT EXISTS idx_script_dependencies_dependency ON script_dependencies(dependency_script_id);

-- Record migration
INSERT INTO workspace_organizer.migrations (id, executed_by) VALUES ('0008-create-script-dependencies', current_user);
`
  },
  {
    id: '0009-add-missing-script-columns',
    description: 'Add has_credentials, execution_count, last_executed_at columns to scripts',
    sql: `
-- Migration: 0009-add-missing-script-columns
-- Description: Add missing columns to scripts table

SET search_path TO workspace_organizer, public;

-- Add has_credentials column if it doesn't exist
ALTER TABLE scripts
ADD COLUMN IF NOT EXISTS has_credentials BOOLEAN DEFAULT false;

-- Add execution_count column if it doesn't exist
ALTER TABLE scripts
ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 0;

-- Add last_executed_at column if it doesn't exist
ALTER TABLE scripts
ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMP WITH TIME ZONE;

-- Record migration
INSERT INTO workspace_organizer.migrations (id, executed_by) VALUES ('0009-add-missing-script-columns', current_user);
`
  },
  {
    id: '0010-fix-null-timestamps',
    description: 'Fix null timestamps in existing records',
    sql: `
-- Migration: 0010-fix-null-timestamps
-- Description: Fix null timestamps in existing records

SET search_path TO workspace_organizer, public;

-- Fix scripts timestamps
UPDATE scripts SET created_at = NOW() WHERE created_at IS NULL;
UPDATE scripts SET updated_at = NOW() WHERE updated_at IS NULL;

-- Fix drive_mappings timestamps
UPDATE drive_mappings SET created_at = NOW() WHERE created_at IS NULL;
UPDATE drive_mappings SET updated_at = NOW() WHERE updated_at IS NULL;

-- Fix tags timestamps
UPDATE tags SET created_at = NOW() WHERE created_at IS NULL;
UPDATE tags SET updated_at = NOW() WHERE updated_at IS NULL;

-- Record migration
INSERT INTO workspace_organizer.migrations (id, executed_by) VALUES ('0010-fix-null-timestamps', current_user);
`
  }
];

/**
 * Get SQL for pending migrations only
 */
export const getPendingMigrationSQLs = (executedIds: Set<string>): MigrationSQL[] => {
  return MIGRATION_SQLS.filter((m) => !executedIds.has(m.id));
};

/**
 * Get unified schema creation SQL script for DBAs
 * This creates the complete schema from scratch with version tracking
 */
export const getUnifiedSchemaSQL = (): string => {
  const header = `-- ============================================================
-- Workspace Organizer - Unified Schema Script
-- ============================================================
-- Schema: ${SHARED_SCHEMA}
-- Version: ${SCHEMA_VERSION}
-- Generated: ${new Date().toISOString()}
--
-- INSTRUCTIONS FOR DBAs:
-- 1. Connect to your PostgreSQL database as a user with CREATE SCHEMA privileges
-- 2. Run this entire script
-- 3. Grant appropriate permissions to application users
-- 4. Provide connection details to application users
--
-- This script is idempotent - safe to run multiple times
-- ============================================================

${SCHEMA_SETUP_SQL}
`;

  const migrations = MIGRATION_SQLS.map((m) => m.sql).join('\n\n');
  const versionMarker = getSchemaVersionSQL(SCHEMA_VERSION);

  return header + migrations + '\n\n' + versionMarker;
};

/**
 * Get all migrations as a single combined SQL script
 * @deprecated Use getUnifiedSchemaSQL() instead for new installations
 */
export const getAllMigrationSQL = (): string => {
  return getUnifiedSchemaSQL();
};

/**
 * Get upgrade SQL from one version to another
 * For now, returns full schema (future: incremental upgrades)
 */
export const getUpgradeSQL = (fromVersion: number, toVersion: number): string => {
  // For v1, there's only one version - return full schema
  if (fromVersion === 0 || fromVersion < toVersion) {
    return getUnifiedSchemaSQL();
  }
  return `-- No upgrade needed (current: ${fromVersion}, target: ${toVersion})`;
};
