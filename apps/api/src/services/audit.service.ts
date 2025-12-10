import { query, queryOne, execute } from '../db/shared-client.js';

import type { AuditLogEntry, AuditAction, AuditLogFilters, PaginatedData } from '@workspace/shared';

interface AuditLogRow {
  id: string;
  user_id: string | null;
  username: string | null;
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
  userId: row.user_id ?? undefined,
  username: row.username ?? undefined,
  action: row.action as AuditAction,
  resourceType: row.resource_type,
  resourceId: row.resource_id ?? undefined,
  oldValue: row.old_value ?? undefined,
  newValue: row.new_value ?? undefined,
  ipAddress: row.ip_address ?? undefined,
  userAgent: row.user_agent ?? undefined,
  metadata: row.metadata ?? undefined,
  timestamp: row.timestamp
});

export interface LogAuditParams {
  userId?: string;
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
  async log(params: LogAuditParams): Promise<AuditLogEntry> {
    const result = await query<AuditLogRow>(
      `INSERT INTO audit_log (user_id, action, resource_type, resource_id, old_value, new_value, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        params.userId ?? null,
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

    // Fetch username if userId was provided
    if (params.userId) {
      const row = result[0];
      const userResult = await queryOne<{ username: string }>(
        'SELECT username FROM users WHERE id = $1',
        [params.userId]
      );
      if (userResult) {
        row.username = userResult.username;
      }
    }

    return mapRowToEntry(result[0]);
  },

  /**
   * Log a create action
   */
  async logCreate(
    userId: string | undefined,
    resourceType: string,
    resourceId: string,
    newValue: Record<string, unknown>,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<AuditLogEntry> {
    return this.log({
      userId,
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
    userId: string | undefined,
    resourceType: string,
    resourceId: string,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<AuditLogEntry> {
    return this.log({
      userId,
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
    userId: string | undefined,
    resourceType: string,
    resourceId: string,
    oldValue: Record<string, unknown>,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<AuditLogEntry> {
    return this.log({
      userId,
      action: 'DELETE',
      resourceType,
      resourceId,
      oldValue,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent
    });
  },

  /**
   * Log a login action
   */
  async logLogin(
    userId: string,
    success: boolean,
    context?: { ipAddress?: string; userAgent?: string; metadata?: Record<string, unknown> }
  ): Promise<AuditLogEntry> {
    return this.log({
      userId,
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
    userId: string,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<AuditLogEntry> {
    return this.log({
      userId,
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
    const offset = (page - 1) * pageSize;

    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_log
       WHERE resource_type = $1 AND resource_id = $2`,
      [resourceType, resourceId]
    );

    const total = countResult ? parseInt(countResult.count, 10) : 0;

    const rows = await query<AuditLogRow>(
      `SELECT al.*, u.username
       FROM audit_log al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.resource_type = $1 AND al.resource_id = $2
       ORDER BY al.timestamp DESC
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
   * Get audit log entries by user
   */
  async getByUser(
    userId: string,
    page = 1,
    pageSize = 50
  ): Promise<PaginatedData<AuditLogEntry>> {
    const offset = (page - 1) * pageSize;

    const countResult = await queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM audit_log WHERE user_id = $1',
      [userId]
    );

    const total = countResult ? parseInt(countResult.count, 10) : 0;

    const rows = await query<AuditLogRow>(
      `SELECT al.*, u.username
       FROM audit_log al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.user_id = $1
       ORDER BY al.timestamp DESC
       LIMIT $2 OFFSET $3`,
      [userId, pageSize, offset]
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
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
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
      `SELECT al.*, u.username
       FROM audit_log al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.timestamp DESC
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
    const rows = await query<AuditLogRow>(
      `SELECT al.*, u.username
       FROM audit_log al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.timestamp > NOW() - INTERVAL '24 hours'
       ORDER BY al.timestamp DESC
       LIMIT $1`,
      [limit]
    );

    return rows.map(mapRowToEntry);
  },

  /**
   * Clean up old audit log entries (older than specified days)
   */
  async cleanup(daysToKeep = 90): Promise<number> {
    const result = await execute(
      `DELETE FROM audit_log WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'`
    );
    return result;
  }
};
