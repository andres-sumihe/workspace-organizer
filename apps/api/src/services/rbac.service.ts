import {
  TEAM_ROLE_PERMISSIONS,
  TEAM_ROLE_HIERARCHY,
  hasMinimumRole,
  roleHasPermission
} from '@workspace/shared';

import {
  getSharedPool,
  isSharedDbConnected,
  SHARED_SCHEMA
} from '../db/shared-client.js';

import type {
  TeamRole,
  TeamResource,
  TeamAction,
  TeamMember
} from '@workspace/shared';


/**
 * RBAC Service - Team-Based Access Control
 * 
 * This service implements role-based access control using team membership.
 * Authentication is ALWAYS local (SQLite), but authorization for shared
 * resources is based on team_members.role in the shared PostgreSQL database.
 * 
 * Role Hierarchy: owner > admin > member
 * 
 * Permission Model:
 * - Permissions are derived from role (hardcoded matrix)
 * - No separate permissions table in shared DB
 * - Resource ownership checked at service level for 'member' role
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

export const rbacService = {
  /**
   * Get a team member's role in a specific team
   */
  async getMemberRole(teamId: string, email: string): Promise<TeamRole | null> {
    if (!isSharedDbConnected()) {
      return null;
    }

    const pool = getSharedPool();
    const result = await pool.query<TeamMemberRow>(
      `SELECT role FROM ${SHARED_SCHEMA}.team_members WHERE team_id = $1 AND email = $2`,
      [teamId, email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const role = result.rows[0].role as TeamRole;
    if (!TEAM_ROLE_HIERARCHY.includes(role)) {
      return null; // Invalid role in database
    }

    return role;
  },

  /**
   * Get full team member info
   */
  async getMember(teamId: string, email: string): Promise<TeamMember | null> {
    if (!isSharedDbConnected()) {
      return null;
    }

    const pool = getSharedPool();
    const result = await pool.query<TeamMemberRow>(
      `SELECT * FROM ${SHARED_SCHEMA}.team_members WHERE team_id = $1 AND email = $2`,
      [teamId, email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      teamId: row.team_id,
      email: row.email,
      displayName: row.display_name ?? undefined,
      role: row.role as TeamRole,
      joinedAt: row.joined_at,
      updatedAt: row.updated_at
    };
  },

  /**
   * Check if a member has permission for an action on a resource
   */
  async hasPermission(
    teamId: string,
    email: string,
    resource: TeamResource,
    action: TeamAction
  ): Promise<boolean> {
    const role = await this.getMemberRole(teamId, email);
    if (!role) {
      return false; // Not a team member
    }

    return roleHasPermission(role, resource, action);
  },

  /**
   * Check if a member has at least the minimum required role
   */
  async hasMinimumRole(
    teamId: string,
    email: string,
    requiredRole: TeamRole
  ): Promise<boolean> {
    const role = await this.getMemberRole(teamId, email);
    if (!role) {
      return false;
    }

    return hasMinimumRole(role, requiredRole);
  },

  /**
   * Check if a member can manage a specific resource (considering ownership)
   * 
   * For 'member' role, they can only manage their own resources.
   * For 'admin' and 'owner', they can manage all resources.
   */
  async canManageResource(
    teamId: string,
    email: string,
    resource: TeamResource,
    action: TeamAction,
    resourceOwnerEmail?: string
  ): Promise<boolean> {
    const role = await this.getMemberRole(teamId, email);
    if (!role) {
      return false;
    }

    // Check base permission
    if (!roleHasPermission(role, resource, action)) {
      return false;
    }

    // For 'member' role, check ownership for update/delete actions
    if (role === 'member' && resourceOwnerEmail && (action === 'update' || action === 'delete')) {
      return email === resourceOwnerEmail;
    }

    return true;
  },

  /**
   * Require a specific role, throw error if insufficient
   */
  async requireRole(
    teamId: string,
    email: string,
    requiredRole: TeamRole
  ): Promise<TeamRole> {
    const role = await this.getMemberRole(teamId, email);
    
    if (!role) {
      const error = new Error('NOT_A_MEMBER');
      error.name = 'ForbiddenError';
      throw error;
    }

    if (!hasMinimumRole(role, requiredRole)) {
      const error = new Error(`INSUFFICIENT_ROLE: Requires ${requiredRole} role`);
      error.name = 'ForbiddenError';
      throw error;
    }

    return role;
  },

  /**
   * Require permission for a resource action, throw error if denied
   */
  async requirePermission(
    teamId: string,
    email: string,
    resource: TeamResource,
    action: TeamAction,
    resourceOwnerEmail?: string
  ): Promise<TeamRole> {
    const role = await this.getMemberRole(teamId, email);
    
    if (!role) {
      const error = new Error('NOT_A_MEMBER');
      error.name = 'ForbiddenError';
      throw error;
    }

    const hasPermission = await this.canManageResource(
      teamId,
      email,
      resource,
      action,
      resourceOwnerEmail
    );

    if (!hasPermission) {
      const error = new Error(`PERMISSION_DENIED: Cannot ${action} ${resource}`);
      error.name = 'ForbiddenError';
      throw error;
    }

    return role;
  },

  /**
   * Get all teams a user is a member of
   */
  async getTeamsByEmail(email: string): Promise<Array<{ teamId: string; teamName: string; role: TeamRole }>> {
    if (!isSharedDbConnected()) {
      return [];
    }

    const pool = getSharedPool();
    const result = await pool.query<{ team_id: string; team_name: string; role: string }>(
      `SELECT tm.team_id, t.name as team_name, tm.role 
       FROM ${SHARED_SCHEMA}.team_members tm
       JOIN ${SHARED_SCHEMA}.teams t ON tm.team_id = t.id
       WHERE tm.email = $1
       ORDER BY t.name`,
      [email]
    );

    return result.rows.map(row => ({
      teamId: row.team_id,
      teamName: row.team_name,
      role: row.role as TeamRole
    }));
  },

  /**
   * Check if user is a member of any team
   */
  async isMemberOfAnyTeam(email: string): Promise<boolean> {
    const teams = await this.getTeamsByEmail(email);
    return teams.length > 0;
  },

  // Re-export helper functions for convenience
  hasMinimumRoleStatic: hasMinimumRole,
  roleHasPermissionStatic: roleHasPermission,
  ROLE_PERMISSIONS: TEAM_ROLE_PERMISSIONS,
  ROLE_HIERARCHY: TEAM_ROLE_HIERARCHY
};
