import { v4 as uuidv4 } from 'uuid';

import { attestationService } from './attestation.service.js';
import { migrationService } from './migration.service.js';
import { modeService } from './mode.service.js';
import {
  getSharedPool,
  initializeSharedDb,
  isSharedDbConnected,
  SHARED_SCHEMA
} from '../db/shared-client.js';
import { ensureSharedSchema, schemaExists, runSharedMigrations } from '../db/shared-migrations/index.js';
import { settingsRepository } from '../repositories/settings.repository.js';

import type { TeamConfigStatus, TestConnectionRequest } from '@workspace/shared';

/**
 * Team row from the database
 */
interface TeamRow {
  id: string;
  name: string;
  description: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Team member row from the database
 */
interface TeamMemberRow {
  id: string;
  team_id: string;
  email: string;
  display_name: string | null;
  role: string;
  joined_at: string;
  updated_at: string;
}

/**
 * Team data for creating a new team
 */
export interface CreateTeamRequest {
  name: string;
  description?: string;
}

/**
 * Result of team creation
 */
export interface CreateTeamResult {
  teamId: string;
  teamName: string;
  memberEmail: string;
  serverId: string;
  publicKey: string;
  schemaName: string;
}

/**
 * Team Configuration Service
 * 
 * Manages the configuration of team/shared features.
 * 
 * IMPORTANT: Authentication is ALWAYS local (SQLite).
 * This service only manages team DATA (scripts, jobs, etc.).
 * Team members are linked via EMAIL, not user_id.
 * 
 * Provides helpers for:
 * - Schema management (ensureSharedSchema)
 * - Team creation and membership (createTeam, joinTeam)
 * - Email-based member lookup (getMemberByEmail)
 * - Attestation and binding flows
 */

export const teamConfigService = {
  /**
   * Get team configuration status
   */
  async getStatus(): Promise<TeamConfigStatus> {
    const modeStatus = await modeService.getStatus();
    const migrationStatus = await migrationService.getStatus();

    return {
      isConfigured: modeStatus.sharedEnabled && modeStatus.sharedDbConnected,
      connectionString: modeStatus.sharedDbConnected ? '[configured]' : undefined,
      lastTestSuccessful: modeStatus.sharedDbConnected,
      pendingMigration: migrationStatus.scriptsCount > 0 || migrationStatus.jobsCount > 0
    };
  },

  /**
   * Test PostgreSQL connection using a connection string
   */
  async testConnection(request: TestConnectionRequest): Promise<{ success: boolean; message: string }> {
    const { testConnection } = await import('../db/shared-client.js');
    
    // Build connection string from individual fields or use provided string
    let connStr: string;
    if ('connectionString' in request && request.connectionString) {
      connStr = request.connectionString as string;
    } else {
      const { host, port, database, user, password, ssl } = request;
      const url = new URL(`postgresql://${host}`);
      url.port = String(port || 5432);
      url.pathname = `/${database}`;
      url.username = user || '';
      url.password = password || '';
      if (ssl) {
        url.searchParams.set('ssl', 'true');
      }
      connStr = url.toString();
    }

    try {
      await testConnection(connStr);
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  },

  /**
   * Disable team features (return to Solo mode)
   * - Sets shared_enabled = false
   * - Clears team_binding from local settings
   * - Leaves shared_db_connection intact for easy re-enable
   */
  async disable(): Promise<{ success: boolean; message: string }> {
    try {
      // Disable shared mode
      await modeService.disableSharedMode();
      
      // Clear team binding (but keep connection string for re-enable)
      await attestationService.clearTeamBinding();
      
      return {
        success: true,
        message: 'Team features disabled. App is now in Solo mode.'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to disable team features'
      };
    }
  },

  /**
   * Get migration status
   */
  async getMigrationStatus() {
    return migrationService.getStatus();
  },

  /**
   * Migrate local data to shared database
   */
  async migrateData(options: { dryRun?: boolean } = {}) {
    return migrationService.migrateScripts(options);
  },

  // =========================================================================
  // Schema Management
  // =========================================================================

  /**
   * Check if the shared schema exists in the connected database
   */
  async schemaExists(): Promise<boolean> {
    if (!isSharedDbConnected()) {
      return false;
    }
    const pool = getSharedPool();
    return schemaExists(pool);
  },

  /**
   * Ensure the shared schema exists (creates it if missing)
   */
  async ensureSchema(): Promise<void> {
    if (!isSharedDbConnected()) {
      throw new Error('Shared database not connected');
    }
    const pool = getSharedPool();
    await ensureSharedSchema(pool);
  },

  /**
   * Get the schema name used for shared tables
   */
  getSchemaName(): string {
    return SHARED_SCHEMA;
  },

  // =========================================================================
  // Team Member Management (Email-based)
  // =========================================================================

  /**
   * Get or create a team member by email
   * Links local users to the shared team via their email address
   */
  async ensureTeamMember(
    teamId: string,
    email: string,
    displayName?: string,
    role: 'owner' | 'admin' | 'member' = 'member'
  ): Promise<TeamMemberRow> {
    if (!isSharedDbConnected()) {
      throw new Error('Shared database not connected');
    }

    const pool = getSharedPool();
    
    // Try to find existing member
    const existing = await pool.query<TeamMemberRow>(
      'SELECT * FROM team_members WHERE team_id = $1 AND email = $2',
      [teamId, email.toLowerCase()]
    );

    if (existing.rows.length > 0) {
      // Update display_name if provided and different
      if (displayName && existing.rows[0].display_name !== displayName) {
        await pool.query(
          'UPDATE team_members SET display_name = $1, updated_at = NOW() WHERE id = $2',
          [displayName, existing.rows[0].id]
        );
      }
      return existing.rows[0];
    }

    // Create new member
    const result = await pool.query<TeamMemberRow>(
      `INSERT INTO team_members (team_id, email, display_name, role, joined_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [teamId, email.toLowerCase(), displayName ?? null, role]
    );

    return result.rows[0];
  },

  /**
   * Get team member by email
   */
  async getMemberByEmail(teamId: string, email: string): Promise<TeamMemberRow | null> {
    if (!isSharedDbConnected()) {
      return null;
    }

    const pool = getSharedPool();
    const result = await pool.query<TeamMemberRow>(
      'SELECT * FROM team_members WHERE team_id = $1 AND email = $2',
      [teamId, email.toLowerCase()]
    );
    return result.rows[0] ?? null;
  },

  /**
   * Get all teams a user (by email) is a member of
   */
  async getMemberTeams(email: string): Promise<Array<TeamRow & { role: string }>> {
    if (!isSharedDbConnected()) {
      return [];
    }

    const pool = getSharedPool();
    const result = await pool.query<TeamRow & { role: string }>(
      `SELECT t.*, tm.role 
       FROM teams t
       INNER JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.email = $1
       ORDER BY t.name`,
      [email.toLowerCase()]
    );
    return result.rows;
  },

  // =========================================================================
  // Team Management
  // =========================================================================

  /**
   * List all teams in the shared schema
   */
  async listTeams(): Promise<TeamRow[]> {
    if (!isSharedDbConnected()) {
      return [];
    }

    const pool = getSharedPool();
    const result = await pool.query<TeamRow>(
      'SELECT * FROM teams ORDER BY name'
    );
    return result.rows;
  },

  /**
   * Get a team by ID
   */
  async getTeamById(teamId: string): Promise<TeamRow | null> {
    if (!isSharedDbConnected()) {
      return null;
    }

    const pool = getSharedPool();
    const result = await pool.query<TeamRow>(
      'SELECT * FROM teams WHERE id = $1',
      [teamId]
    );
    return result.rows[0] ?? null;
  },

  /**
   * Get a team by name
   */
  async getTeamByName(name: string): Promise<TeamRow | null> {
    if (!isSharedDbConnected()) {
      return null;
    }

    const pool = getSharedPool();
    const result = await pool.query<TeamRow>(
      'SELECT * FROM teams WHERE name = $1',
      [name]
    );
    return result.rows[0] ?? null;
  },

  /**
   * Create a new team and assign the creator as owner.
   * Also initializes app_info/attestation and stores local team binding.
   * 
   * @param request - Team name and optional description
   * @param creatorEmail - Email of the user creating the team (from local auth)
   * @param creatorDisplayName - Optional display name
   * @returns Team creation result with IDs for local binding
   */
  async createTeam(
    request: CreateTeamRequest,
    creatorEmail: string,
    creatorDisplayName?: string
  ): Promise<CreateTeamResult> {
    if (!isSharedDbConnected()) {
      throw new Error('Shared database not connected');
    }

    const pool = getSharedPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check if team name already exists
      const existingTeam = await client.query<TeamRow>(
        'SELECT * FROM teams WHERE name = $1',
        [request.name]
      );

      if (existingTeam.rows.length > 0) {
        throw new Error(`Team "${request.name}" already exists`);
      }

      // Create the team
      const teamId = uuidv4();
      await client.query(
        `INSERT INTO teams (id, name, description, created_by_email, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [teamId, request.name, request.description ?? null, creatorEmail.toLowerCase()]
      );

      // Add creator as team owner
      await client.query(
        `INSERT INTO team_members (team_id, email, display_name, role, joined_at, updated_at)
         VALUES ($1, $2, $3, 'owner', NOW(), NOW())`,
        [teamId, creatorEmail.toLowerCase(), creatorDisplayName ?? null]
      );

      await client.query('COMMIT');

      // Initialize app_info and attestation (outside transaction)
      const appInfo = await attestationService.initializeAppInfo(teamId, request.name);

      // Store team binding locally
      await attestationService.storeTeamBinding(appInfo);

      return {
        teamId,
        teamName: request.name,
        memberEmail: creatorEmail,
        serverId: appInfo.serverId,
        publicKey: appInfo.publicKey,
        schemaName: SHARED_SCHEMA
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Update a team member's role
   * Role hierarchy: owner > admin > member
   */
  async updateMemberRole(
    teamId: string,
    email: string,
    newRole: 'owner' | 'admin' | 'member'
  ): Promise<void> {
    if (!isSharedDbConnected()) {
      throw new Error('Shared database not connected');
    }

    const pool = getSharedPool();
    await pool.query(
      'UPDATE team_members SET role = $1, updated_at = NOW() WHERE team_id = $2 AND email = $3',
      [newRole, teamId, email.toLowerCase()]
    );
  },

  /**
   * Connect to an existing shared database by connection string.
   * Stores the connection, initializes the pool, ensures schema/migrations,
   * stores team binding if available, and enables shared mode.
   */
  async connectExistingTeam(connectionString: string): Promise<{
    schemaName: string;
    bindingStored: boolean;
    needsTeamSetup: boolean;
  }> {
    if (!connectionString?.trim()) {
      throw new Error('Connection string is required');
    }

    // Persist the connection string locally
    await settingsRepository.set('shared_db_connection', connectionString.trim());

    // Initialize pool (creates schema + sets search_path)
    await initializeSharedDb(connectionString.trim());

    const pool = getSharedPool();

    // Ensure schema exists and migrations are up to date
    await ensureSharedSchema(pool);
    await runSharedMigrations(pool);

    // Attempt to fetch app info for binding (if team already initialized)
    const appInfo = await attestationService.getAppInfo();
    if (appInfo) {
      await attestationService.storeTeamBinding(appInfo);
    }

    // Enable shared mode locally
    await modeService.enableSharedMode();

    return {
      schemaName: SHARED_SCHEMA,
      bindingStored: Boolean(appInfo),
      needsTeamSetup: !appInfo
    };
  },

  /**
   * Join an existing team.
   * @param teamId - The team to join
   * @param email - Email of the user joining (from local auth)
   * @param displayName - Optional display name
   * @param asAdmin - Whether to join as admin (default: false, joins as member)
   */
  async joinTeam(
    teamId: string,
    email: string,
    displayName?: string,
    asAdmin: boolean = false
  ): Promise<TeamMemberRow> {
    const role = asAdmin ? 'admin' : 'member';
    const member = await this.ensureTeamMember(teamId, email, displayName, role);

    // Update local binding if app_info exists
    const appInfo = await attestationService.getAppInfo();
    if (appInfo) {
      await attestationService.storeTeamBinding(appInfo);
    }

    return member;
  },

  /**
   * Check if an email is a member of a team
   */
  async isTeamMember(teamId: string, email: string): Promise<boolean> {
    const member = await this.getMemberByEmail(teamId, email);
    return member !== null;
  },

  /**
   * Get user's role in a team by email
   */
  async getTeamRole(teamId: string, email: string): Promise<string | null> {
    const member = await this.getMemberByEmail(teamId, email);
    return member?.role ?? null;
  },

  /**
   * Get all members of a team
   */
  async getTeamMembers(teamId: string): Promise<TeamMemberRow[]> {
    if (!isSharedDbConnected()) {
      return [];
    }

    const pool = getSharedPool();
    const result = await pool.query<TeamMemberRow>(
      'SELECT * FROM team_members WHERE team_id = $1 ORDER BY role, email',
      [teamId]
    );
    return result.rows;
  }
};
