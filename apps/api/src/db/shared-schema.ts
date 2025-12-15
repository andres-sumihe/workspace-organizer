/**
 * Shared PostgreSQL Schema Configuration
 *
 * Defines the schema name used for all shared/team tables in PostgreSQL.
 * This ensures consistent schema usage across:
 * - Connection pool setup (search_path)
 * - Migration runner
 * - All shared database queries
 *
 * Using a dedicated schema (vs public) provides:
 * - Clear separation from other applications sharing the same database
 * - Easier backup/restore of just the app's tables
 * - Simplified permission management
 */

/**
 * The PostgreSQL schema name for all Workspace Organizer shared tables.
 * Tables: users, roles, permissions, sessions, audit_log, scripts,
 *         controlm_jobs, app_info, app_secrets, teams, team_members, migrations
 */
export const SHARED_SCHEMA = 'workspace_organizer';

/**
 * Build the search_path setting for PostgreSQL connections.
 * Includes 'public' as fallback for any extensions or shared utilities.
 */
export const getSearchPath = (): string => {
  return `${SHARED_SCHEMA}, public`;
};

/**
 * Get a schema-qualified table name.
 * Use this for explicit schema references (e.g., in migrations table tracking).
 * @param tableName - The unqualified table name
 * @returns Schema-qualified table name (e.g., "workspace_organizer.migrations")
 */
export const qualifyTable = (tableName: string): string => {
  return `${SHARED_SCHEMA}.${tableName}`;
};
