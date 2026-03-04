-- ============================================================================
-- Workspace Organizer - Unified Database Schema
-- Version: 0.3.0
-- Schema: workspace_organizer
-- ============================================================================
--
-- This script creates the complete shared database schema for fresh installations.
-- Run this script once on a new PostgreSQL database.
--
-- Usage: psql -h <host> -U <user> -d <database> -f init.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. CREATE SCHEMA
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS workspace_organizer;

-- Set search path for this session
SET search_path TO workspace_organizer, public;

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. HELPER FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION workspace_organizer.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. TEAMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT teams_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_teams_name ON workspace_organizer.teams (name);

DROP TRIGGER IF EXISTS trg_teams_updated_at ON workspace_organizer.teams;
CREATE TRIGGER trg_teams_updated_at
BEFORE UPDATE ON workspace_organizer.teams
FOR EACH ROW
EXECUTE FUNCTION workspace_organizer.update_updated_at_column();

-- ============================================================================
-- 4. TEAM MEMBERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES workspace_organizer.teams(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT team_members_team_email_unique UNIQUE (team_id, email)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON workspace_organizer.team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON workspace_organizer.team_members (email);

DROP TRIGGER IF EXISTS trg_team_members_updated_at ON workspace_organizer.team_members;
CREATE TRIGGER trg_team_members_updated_at
BEFORE UPDATE ON workspace_organizer.team_members
FOR EACH ROW
EXECUTE FUNCTION workspace_organizer.update_updated_at_column();

-- ============================================================================
-- 5. AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES workspace_organizer.teams(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_audit_log_team_id ON workspace_organizer.audit_log (team_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_member_email ON workspace_organizer.audit_log (member_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON workspace_organizer.audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type ON workspace_organizer.audit_log (resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_id ON workspace_organizer.audit_log (resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON workspace_organizer.audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON workspace_organizer.audit_log (resource_type, resource_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_member_timestamp ON workspace_organizer.audit_log (member_email, timestamp DESC);

-- ============================================================================
-- 6. SCRIPTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES workspace_organizer.teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  content TEXT,
  type VARCHAR(50) DEFAULT 'batch',
  is_active BOOLEAN DEFAULT true,
  has_credentials BOOLEAN DEFAULT false,
  tags TEXT[],
  created_by VARCHAR(255),
  updated_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scripts_team ON workspace_organizer.scripts (team_id);
CREATE INDEX IF NOT EXISTS idx_scripts_name ON workspace_organizer.scripts (name);
CREATE INDEX IF NOT EXISTS idx_scripts_type ON workspace_organizer.scripts (type);
CREATE INDEX IF NOT EXISTS idx_scripts_is_active ON workspace_organizer.scripts (is_active);
CREATE INDEX IF NOT EXISTS idx_scripts_tags ON workspace_organizer.scripts USING GIN (tags);

DROP TRIGGER IF EXISTS trg_scripts_updated_at ON workspace_organizer.scripts;
CREATE TRIGGER trg_scripts_updated_at
BEFORE UPDATE ON workspace_organizer.scripts
FOR EACH ROW
EXECUTE FUNCTION workspace_organizer.update_updated_at_column();

-- ============================================================================
-- 7. DRIVE MAPPINGS (per-script)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.drive_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  script_id UUID NOT NULL REFERENCES workspace_organizer.scripts(id) ON DELETE CASCADE,
  drive_letter VARCHAR(5) NOT NULL,
  network_path VARCHAR(1000) NOT NULL,
  server_name VARCHAR(255),
  has_credentials BOOLEAN DEFAULT false,
  username VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT drive_mappings_script_letter_unique UNIQUE (script_id, drive_letter)
);

CREATE INDEX IF NOT EXISTS idx_drive_mappings_script_id ON workspace_organizer.drive_mappings (script_id);
CREATE INDEX IF NOT EXISTS idx_drive_mappings_drive_letter ON workspace_organizer.drive_mappings (drive_letter);

DROP TRIGGER IF EXISTS trg_drive_mappings_updated_at ON workspace_organizer.drive_mappings;
CREATE TRIGGER trg_drive_mappings_updated_at
BEFORE UPDATE ON workspace_organizer.drive_mappings
FOR EACH ROW
EXECUTE FUNCTION workspace_organizer.update_updated_at_column();

-- ============================================================================
-- 8. TAGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  color VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_tags_updated_at ON workspace_organizer.tags;
CREATE TRIGGER trg_tags_updated_at
BEFORE UPDATE ON workspace_organizer.tags
FOR EACH ROW
EXECUTE FUNCTION workspace_organizer.update_updated_at_column();

-- ============================================================================
-- 9. SCRIPT TAGS (junction)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.script_tags (
  script_id UUID NOT NULL REFERENCES workspace_organizer.scripts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES workspace_organizer.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (script_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_script_tags_script ON workspace_organizer.script_tags (script_id);
CREATE INDEX IF NOT EXISTS idx_script_tags_tag ON workspace_organizer.script_tags (tag_id);

-- ============================================================================
-- 10. SCRIPT DEPENDENCIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.script_dependencies (
  dependent_script_id UUID NOT NULL REFERENCES workspace_organizer.scripts(id) ON DELETE CASCADE,
  dependency_script_id UUID NOT NULL REFERENCES workspace_organizer.scripts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dependent_script_id, dependency_script_id)
);

CREATE INDEX IF NOT EXISTS idx_script_dependencies_dependent ON workspace_organizer.script_dependencies (dependent_script_id);
CREATE INDEX IF NOT EXISTS idx_script_dependencies_dependency ON workspace_organizer.script_dependencies (dependency_script_id);

-- ============================================================================
-- 11. CONTROL-M JOBS
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.controlm_jobs (
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
  linked_script_id UUID REFERENCES workspace_organizer.scripts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_controlm_jobs_job_id ON workspace_organizer.controlm_jobs (job_id);
CREATE INDEX IF NOT EXISTS idx_controlm_jobs_application ON workspace_organizer.controlm_jobs (application);
CREATE INDEX IF NOT EXISTS idx_controlm_jobs_group ON workspace_organizer.controlm_jobs (group_name);
CREATE INDEX IF NOT EXISTS idx_controlm_jobs_name ON workspace_organizer.controlm_jobs (job_name);
CREATE INDEX IF NOT EXISTS idx_controlm_jobs_active ON workspace_organizer.controlm_jobs (is_active);
CREATE INDEX IF NOT EXISTS idx_controlm_jobs_script ON workspace_organizer.controlm_jobs (linked_script_id);

DROP TRIGGER IF EXISTS trg_controlm_jobs_updated_at ON workspace_organizer.controlm_jobs;
CREATE TRIGGER trg_controlm_jobs_updated_at
BEFORE UPDATE ON workspace_organizer.controlm_jobs
FOR EACH ROW
EXECUTE FUNCTION workspace_organizer.update_updated_at_column();

-- ============================================================================
-- 12. JOB DEPENDENCIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.job_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  predecessor_job_id VARCHAR(255) NOT NULL,
  successor_job_id VARCHAR(255) NOT NULL,
  condition_type VARCHAR(50) DEFAULT 'OK',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_dependencies_predecessor ON workspace_organizer.job_dependencies (predecessor_job_id);
CREATE INDEX IF NOT EXISTS idx_job_dependencies_successor ON workspace_organizer.job_dependencies (successor_job_id);

-- ============================================================================
-- 13. JOB CONDITIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.job_conditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id VARCHAR(255) NOT NULL,
  condition_name VARCHAR(255) NOT NULL,
  condition_type VARCHAR(50) NOT NULL,
  odate VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_conditions_job ON workspace_organizer.job_conditions (job_id);

-- ============================================================================
-- 14. APP INFO (Team Attestation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.app_info (
  server_id UUID PRIMARY KEY,
  team_id UUID REFERENCES workspace_organizer.teams(id) ON DELETE CASCADE,
  team_name VARCHAR(255) NOT NULL,
  public_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_info_team ON workspace_organizer.app_info (team_id);

-- ============================================================================
-- 15. APP SECRETS
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.app_secrets (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE workspace_organizer.app_secrets IS 'Secure storage for server secrets. Access should be restricted.';

-- ============================================================================
-- 16. TEAM PROJECTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.team_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES workspace_organizer.teams(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  start_date DATE,
  due_date DATE,
  actual_end_date DATE,
  business_proposal_id VARCHAR(255),
  change_id VARCHAR(255),
  created_by_email VARCHAR(255) NOT NULL,
  updated_by_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_projects_team ON workspace_organizer.team_projects (team_id);
CREATE INDEX IF NOT EXISTS idx_team_projects_status ON workspace_organizer.team_projects (team_id, status);
CREATE INDEX IF NOT EXISTS idx_team_projects_created_by ON workspace_organizer.team_projects (created_by_email);

DROP TRIGGER IF EXISTS trg_team_projects_updated_at ON workspace_organizer.team_projects;
CREATE TRIGGER trg_team_projects_updated_at
BEFORE UPDATE ON workspace_organizer.team_projects
FOR EACH ROW
EXECUTE FUNCTION workspace_organizer.update_updated_at_column();

-- ============================================================================
-- 17. TEAM NOTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.team_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES workspace_organizer.teams(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES workspace_organizer.team_projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_email VARCHAR(255) NOT NULL,
  updated_by_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_notes_team ON workspace_organizer.team_notes (team_id);
CREATE INDEX IF NOT EXISTS idx_team_notes_project ON workspace_organizer.team_notes (project_id);
CREATE INDEX IF NOT EXISTS idx_team_notes_pinned ON workspace_organizer.team_notes (project_id, is_pinned);

DROP TRIGGER IF EXISTS trg_team_notes_updated_at ON workspace_organizer.team_notes;
CREATE TRIGGER trg_team_notes_updated_at
BEFORE UPDATE ON workspace_organizer.team_notes
FOR EACH ROW
EXECUTE FUNCTION workspace_organizer.update_updated_at_column();

-- ============================================================================
-- 18. TEAM NOTE REVISIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.team_note_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID NOT NULL REFERENCES workspace_organizer.team_notes(id) ON DELETE CASCADE,
  title VARCHAR(255),
  content TEXT NOT NULL,
  saved_by_email VARCHAR(255) NOT NULL,
  editors JSONB NOT NULL DEFAULT '[]'::jsonb,
  revision_number INTEGER NOT NULL,
  snapshot_trigger VARCHAR(50) NOT NULL DEFAULT 'auto',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_note_revisions_note ON workspace_organizer.team_note_revisions (note_id);
CREATE INDEX IF NOT EXISTS idx_team_note_revisions_number ON workspace_organizer.team_note_revisions (note_id, revision_number);

-- ============================================================================
-- 19. TEAM TASKS
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.team_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES workspace_organizer.teams(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES workspace_organizer.team_projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  priority VARCHAR(50) NOT NULL DEFAULT 'medium',
  due_date DATE,
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by_email VARCHAR(255) NOT NULL,
  updated_by_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_tasks_team ON workspace_organizer.team_tasks (team_id);
CREATE INDEX IF NOT EXISTS idx_team_tasks_project ON workspace_organizer.team_tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_team_tasks_status ON workspace_organizer.team_tasks (project_id, status);
CREATE INDEX IF NOT EXISTS idx_team_tasks_priority ON workspace_organizer.team_tasks (project_id, priority);

DROP TRIGGER IF EXISTS trg_team_tasks_updated_at ON workspace_organizer.team_tasks;
CREATE TRIGGER trg_team_tasks_updated_at
BEFORE UPDATE ON workspace_organizer.team_tasks
FOR EACH ROW
EXECUTE FUNCTION workspace_organizer.update_updated_at_column();

-- ============================================================================
-- 20. TEAM TASK ASSIGNMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.team_task_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES workspace_organizer.team_tasks(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT team_task_assignments_unique UNIQUE (task_id, email)
);

CREATE INDEX IF NOT EXISTS idx_team_task_assignments_task ON workspace_organizer.team_task_assignments (task_id);
CREATE INDEX IF NOT EXISTS idx_team_task_assignments_email ON workspace_organizer.team_task_assignments (email);

-- ============================================================================
-- 21. TEAM TASK UPDATES
-- ============================================================================
CREATE TABLE IF NOT EXISTS workspace_organizer.team_task_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES workspace_organizer.teams(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES workspace_organizer.team_tasks(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES workspace_organizer.team_task_updates(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by_email VARCHAR(255) NOT NULL,
  created_by_display_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_task_updates_task ON workspace_organizer.team_task_updates (task_id);
CREATE INDEX IF NOT EXISTS idx_team_task_updates_parent ON workspace_organizer.team_task_updates (parent_id);
CREATE INDEX IF NOT EXISTS idx_team_task_updates_created_by ON workspace_organizer.team_task_updates (created_by_email);

DROP TRIGGER IF EXISTS trg_team_task_updates_updated_at ON workspace_organizer.team_task_updates;
CREATE TRIGGER trg_team_task_updates_updated_at
BEFORE UPDATE ON workspace_organizer.team_task_updates
FOR EACH ROW
EXECUTE FUNCTION workspace_organizer.update_updated_at_column();

COMMIT;

-- ============================================================================
-- DATABASE INITIALIZATION COMPLETE
-- ============================================================================
-- Your database is now ready for use with Workspace Organizer.
-- All tables are in the 'workspace_organizer' schema.
-- ============================================================================
