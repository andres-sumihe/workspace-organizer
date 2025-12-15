import { query, queryOne, execute, isSharedDbConnected } from '../db/shared-client.js';

import type { AuditLogEntry, AuditAction, AuditLogFilters, PaginatedData } from '@workspace/shared';

/**
 * Audit Log Service
 * 
 * Logs all changes to shared resources in PostgreSQL.
 * NOTE: Uses member_email to identify users since authentication
 * is always local (SQLite). The email links to team_members table.
 */

interface AuditLogRow {
  id: string;
  team_id: string | null;
  member_email: string | null;
  member_display_name: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
}

const mapRowToEntry = (row: AuditLogRow): AuditLogEntry => ({
  id: row.id,
  userId: undefined, // No longer used - auth is local
  username: row.member_display_name ?? row.member_email ?? undefined,
  action: row.action as AuditAction,
  resourceType: row.resource_type,
  resourceId: row.resource_id ?? undefined,
  oldValue: row.old_value ?? undefined,
  newValue: row.new_value ?? undefined,
  ipAddress: row.ip_address ?? undefined,
  userAgent: row.user_agent ?? undefined,
  metadata: {
    ...row.metadata,
    teamId: row.team_id ?? undefined,
    memberEmail: row.member_email ?? undefined
  },
  timestamp: row.timestamp
});

export interface LogAuditParams {
  /** Email of the member performing the action (from local user) */
  memberEmail?: string;
  /** Display name of the member */
  memberDisplayName?: string;
  /** Team ID if action is team-scoped */
  teamId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export const auditService = {
  /**
   * Log an audit entry
   */
  async log(params: LogAuditParams): Promise<AuditLogEntry | null> {
    // Only log if shared DB is connected (team features)
    if (!isSharedDbConnected()) {
      return null;
    }

    const result = await query<AuditLogRow>(
      `INSERT INTO audit_log (team_id, member_email, member_display_name, action, resource_type, resource_id, old_value, new_value, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        params.teamId ?? null,
        params.memberEmail ?? null,
        params.memberDisplayName ?? null,
        params.action,
        params.resourceType,
        params.resourceId ?? null,
        params.oldValue ? JSON.stringify(params.oldValue) : null,
        params.newValue ? JSON.stringify(params.newValue) : null,
        params.ipAddress ?? null,
        params.userAgent ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null
      ]
    );

    return mapRowToEntry(result[0]);
  },

  /**
   * Log a create action
   */
  async logCreate(
    memberEmail: string | undefined,
    resourceType: string,
    resourceId: string,
    newValue: Record<string, unknown>,
    context?: { ipAddress?: string; userAgent?: string; teamId?: string; memberDisplayName?: string }
  ): Promise<AuditLogEntry | null> {
    return this.log({
      memberEmail,
      memberDisplayName: context?.memberDisplayName,
      teamId: context?.teamId,
      action: 'CREATE',
      resourceType,
      resourceId,
      newValue,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent
    });
  },

  /**
   * Log an update action
   */
  async logUpdate(
    memberEmail: string | undefined,
    resourceType: string,
    resourceId: string,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
    context?: { ipAddress?: string; userAgent?: string; teamId?: string; memberDisplayName?: string }
  ): Promise<AuditLogEntry | null> {
    return this.log({
      memberEmail,
      memberDisplayName: context?.memberDisplayName,
      teamId: context?.teamId,
      action: 'UPDATE',
      resourceType,
      resourceId,
      oldValue,
      newValue,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent
    });
  },

  /**
   * Log a delete action
   */
  async logDelete(
    memberEmail: string | undefined,
    resourceType: string,
    resourceId: string,
    oldValue: Record<string, unknown>,
    context?: { ipAddress?: string; userAgent?: string; teamId?: string; memberDisplayName?: string }
  ): Promise<AuditLogEntry | null> {
    return this.log({
      memberEmail,
      memberDisplayName: context?.memberDisplayName,
      teamId: context?.teamId,
      action: 'DELETE',
      resourceType,
      resourceId,
      oldValue,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent
    });
  },

  /**
   * Log a login action (for team-related auditing only)
   */
  async logLogin(
    memberEmail: string,
    success: boolean,
    context?: { ipAddress?: string; userAgent?: string; metadata?: Record<string, unknown>; teamId?: string; memberDisplayName?: string }
  ): Promise<AuditLogEntry | null> {
    return this.log({
      memberEmail,
      memberDisplayName: context?.memberDisplayName,
      teamId: context?.teamId,
      action: success ? 'LOGIN' : 'LOGIN_FAILED',
      resourceType: 'session',
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: context?.metadata
    });
  },

  /**
   * Log a logout action
   */
  async logLogout(
    memberEmail: string,
    context?: { ipAddress?: string; userAgent?: string; teamId?: string; memberDisplayName?: string }
  ): Promise<AuditLogEntry | null> {
    return this.log({
      memberEmail,
      memberDisplayName: context?.memberDisplayName,
      teamId: context?.teamId,
      action: 'LOGOUT',
      resourceType: 'session',
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent
    });
  },

  /**
   * Get audit log entries by resource
   */
  async getByResource(
    resourceType: string,
    resourceId: string,
    page = 1,
    pageSize = 50
  ): Promise<PaginatedData<AuditLogEntry>> {
    if (!isSharedDbConnected()) {
      return { items: [], meta: { total: 0, page, pageSize, hasNextPage: false, hasPreviousPage: false } };
    }

    const offset = (page - 1) * pageSize;

    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_log
       WHERE resource_type = $1 AND resource_id = $2`,
      [resourceType, resourceId]
    );

    const total = countResult ? parseInt(countResult.count, 10) : 0;

    const rows = await query<AuditLogRow>(
      `SELECT *
       FROM audit_log
       WHERE resource_type = $1 AND resource_id = $2
       ORDER BY timestamp DESC
       LIMIT $3 OFFSET $4`,
      [resourceType, resourceId, pageSize, offset]
    );

    return {
      items: rows.map(mapRowToEntry),
      meta: {
        total,
        page,
        pageSize,
        hasNextPage: offset + rows.length < total,
        hasPreviousPage: page > 1
      }
    };
  },

  /**
   * Get audit log entries by member email
   */
  async getByMember(
    memberEmail: string,
    page = 1,
    pageSize = 50
  ): Promise<PaginatedData<AuditLogEntry>> {
    if (!isSharedDbConnected()) {
      return { items: [], meta: { total: 0, page, pageSize, hasNextPage: false, hasPreviousPage: false } };
    }

    const offset = (page - 1) * pageSize;

    const countResult = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM audit_log WHERE member_email = $1',
      [memberEmail]
    );

    const total = countResult ? parseInt(countResult.count, 10) : 0;

    const rows = await query<AuditLogRow>(
      `SELECT *
       FROM audit_log
       WHERE member_email = $1
       ORDER BY timestamp DESC
       LIMIT $2 OFFSET $3`,
      [memberEmail, pageSize, offset]
    );

    return {
      items: rows.map(mapRowToEntry),
      meta: {
        total,
        page,
        pageSize,
        hasNextPage: offset + rows.length < total,
        hasPreviousPage: page > 1
      }
    };
  },

  /**
   * Get all audit log entries with filters
   */
  async getAll(
    filters: AuditLogFilters = {},
    page = 1,
    pageSize = 50
  ): Promise<PaginatedData<AuditLogEntry>> {
    if (!isSharedDbConnected()) {
      return { items: [], meta: { total: 0, page, pageSize, hasNextPage: false, hasPreviousPage: false } };
    }

    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    // Support both userId (legacy) and memberEmail for filtering
    if (filters.userId) {
      // Legacy: treat as email search
      conditions.push(`member_email = $${paramIndex++}`);
      params.push(filters.userId);
    }

    if (filters.action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(filters.action);
    }

    if (filters.resourceType) {
      conditions.push(`resource_type = $${paramIndex++}`);
      params.push(filters.resourceType);
    }

    if (filters.resourceId) {
      conditions.push(`resource_id = $${paramIndex++}`);
      params.push(filters.resourceId);
    }

    if (filters.fromDate) {
      conditions.push(`timestamp >= $${paramIndex++}`);
      params.push(filters.fromDate);
    }

    if (filters.toDate) {
      conditions.push(`timestamp <= $${paramIndex++}`);
      params.push(filters.toDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_log ${whereClause}`,
      params
    );

    const total = countResult ? parseInt(countResult.count, 10) : 0;

    const rows = await query<AuditLogRow>(
      `SELECT *
       FROM audit_log
       ${whereClause}
       ORDER BY timestamp DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, pageSize, offset]
    );

    return {
      items: rows.map(mapRowToEntry),
      meta: {
        total,
        page,
        pageSize,
        hasNextPage: offset + rows.length < total,
        hasPreviousPage: page > 1
      }
    };
  },

  /**
   * Get recent audit log entries (last 24 hours)
   */
  async getRecent(limit = 100): Promise<AuditLogEntry[]> {
    if (!isSharedDbConnected()) {
      return [];
    }

    const rows = await query<AuditLogRow>(
      `SELECT *
       FROM audit_log
       WHERE timestamp > NOW() - INTERVAL '24 hours'
       ORDER BY timestamp DESC
       LIMIT $1`,
      [limit]
    );

    return rows.map(mapRowToEntry);
  },

  /**
   * Clean up old audit log entries (older than specified days)
   */
  async cleanup(daysToKeep = 90): Promise<number> {
    if (!isSharedDbConnected()) {
      return 0;
    }

    const result = await execute(
      `DELETE FROM audit_log WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'`
    );
    return result;
  }
};
