/**
 * Team-scoped scripts routes
 * 
 * All routes require team membership and respect RBAC permissions.
 * Scripts are scoped to teams via team_id in the database.
 */

import { Router } from 'express';

import { query, queryOne, execute } from '../../db/shared-client.js';
import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireTeamRole, requireResourceOwnership } from '../../middleware/team-rbac.middleware.js';
import { parsePaginationQuery } from '../../schemas/pagination.js';
import { auditService } from '../../services/audit.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

import type { TeamAuthenticatedRequest } from '../../middleware/team-rbac.middleware.js';
import type { ScriptType } from '@workspace/shared';
import type { RequestHandler, Response } from 'express';

export const teamScriptsRouter = Router({ mergeParams: true });

// All routes require authentication
teamScriptsRouter.use(requireAuth as RequestHandler);

// Database row types
interface ScriptRow {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  file_path: string | null;
  content: string | null;
  type: string;
  is_active: boolean;
  tags: string[] | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// Map row to response object
const mapScriptRow = (row: ScriptRow) => ({
  id: row.id,
  teamId: row.team_id,
  name: row.name,
  description: row.description ?? undefined,
  filePath: row.file_path ?? undefined,
  content: row.content ?? undefined,
  type: row.type as ScriptType,
  isActive: row.is_active,
  tags: row.tags ?? [],
  createdBy: row.created_by ?? undefined,
  updatedBy: row.updated_by ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

/**
 * GET /teams/:teamId/scripts
 * List scripts for the team (requires membership)
 */
teamScriptsRouter.get('/', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId } = req;
  const pagination = parsePaginationQuery(req.query);
  
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
  const searchQuery = typeof req.query.searchQuery === 'string' ? req.query.searchQuery : undefined;

  const conditions: string[] = ['team_id = $1'];
  const values: unknown[] = [teamId];
  let paramIndex = 2;

  if (type !== undefined) {
    conditions.push(`type = $${paramIndex++}`);
    values.push(type);
  }

  if (isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    values.push(isActive);
  }

  if (searchQuery !== undefined && searchQuery.trim() !== '') {
    conditions.push(`(name ILIKE $${paramIndex} OR file_path ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
    values.push(`%${searchQuery}%`);
    paramIndex++;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // Get count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(1) as count FROM scripts ${whereClause}`,
    values
  );
  const total = countResult ? parseInt(countResult.count, 10) : 0;

  // Get items
  const limit = pagination.pageSize;
  const offset = (pagination.page - 1) * pagination.pageSize;
  values.push(limit, offset);

  const rows = await query<ScriptRow>(
    `SELECT * FROM scripts ${whereClause} ORDER BY name LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );

  const items = rows.map(mapScriptRow);

  res.json({
    items,
    meta: {
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      hasNextPage: pagination.page * pagination.pageSize < total,
      hasPreviousPage: pagination.page > 1
    }
  });
}));

/**
 * GET /teams/:teamId/scripts/:scriptId
 * Get a specific script (requires membership)
 */
teamScriptsRouter.get('/:scriptId', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId } = req;
  const { scriptId } = req.params;

  const row = await queryOne<ScriptRow>(
    'SELECT * FROM scripts WHERE id = $1 AND team_id = $2',
    [scriptId, teamId]
  );

  if (!row) {
    throw new AppError('Script not found', 404, 'SCRIPT_NOT_FOUND');
  }

  res.json({ script: mapScriptRow(row) });
}));

/**
 * POST /teams/:teamId/scripts
 * Create a new script (requires membership)
 */
teamScriptsRouter.post('/', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, memberEmail } = req;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const name = typeof body.name === 'string' ? body.name : undefined;
  const description = typeof body.description === 'string' ? body.description : undefined;
  const filePath = typeof body.filePath === 'string' ? body.filePath : undefined;
  const content = typeof body.content === 'string' ? body.content : undefined;
  const type = typeof body.type === 'string' ? body.type : 'batch';
  const isActive = typeof body.isActive === 'boolean' ? body.isActive : true;
  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === 'string') : [];

  if (!name) {
    throw new AppError('Name is required', 400, 'INVALID_REQUEST');
  }

  const result = await query<ScriptRow>(
    `INSERT INTO scripts (team_id, name, description, file_path, content, type, is_active, tags, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
     RETURNING *`,
    [teamId, name, description ?? null, filePath ?? null, content ?? null, type, isActive, tags, memberEmail]
  );

  const script = mapScriptRow(result[0]);

  // Log audit event
  await auditService.log({
    action: 'SCRIPT_CREATE',
    teamId: teamId!,
    memberEmail: memberEmail!,
    memberDisplayName: req.user?.displayName,
    resourceType: 'script',
    resourceId: script.id,
    metadata: { name: script.name }
  });

  res.status(201).json({ script });
}));

/**
 * Helper to get script owner email
 */
const getScriptOwner = async (req: TeamAuthenticatedRequest): Promise<string | undefined> => {
  const { teamId } = req;
  const { scriptId } = req.params;

  const row = await queryOne<{ created_by: string | null }>(
    'SELECT created_by FROM scripts WHERE id = $1 AND team_id = $2',
    [scriptId, teamId]
  );

  return row?.created_by ?? undefined;
};

/**
 * PATCH /teams/:teamId/scripts/:scriptId
 * Update a script (member can only update own scripts, admin/owner can update any)
 */
teamScriptsRouter.patch(
  '/:scriptId',
  requireTeamRole('member'),
  requireResourceOwnership('scripts', 'update', getScriptOwner),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    const { teamId, memberEmail } = req;
    const { scriptId } = req.params;
    const body = (req.body ?? {}) as Record<string, unknown>;

    // Check script exists
    const existing = await queryOne<ScriptRow>(
      'SELECT * FROM scripts WHERE id = $1 AND team_id = $2',
      [scriptId, teamId]
    );

    if (!existing) {
      throw new AppError('Script not found', 404, 'SCRIPT_NOT_FOUND');
    }

    // Build update query
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (typeof body.name === 'string') {
      updates.push(`name = $${paramIndex++}`);
      values.push(body.name);
    }

    if (typeof body.description === 'string') {
      updates.push(`description = $${paramIndex++}`);
      values.push(body.description);
    }

    if (typeof body.filePath === 'string') {
      updates.push(`file_path = $${paramIndex++}`);
      values.push(body.filePath);
    }

    if (typeof body.content === 'string') {
      updates.push(`content = $${paramIndex++}`);
      values.push(body.content);
    }

    if (typeof body.type === 'string') {
      updates.push(`type = $${paramIndex++}`);
      values.push(body.type);
    }

    if (typeof body.isActive === 'boolean') {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(body.isActive);
    }

    if (Array.isArray(body.tags)) {
      const tags = body.tags.filter((t): t is string => typeof t === 'string');
      updates.push(`tags = $${paramIndex++}`);
      values.push(tags);
    }

    if (updates.length === 0) {
      res.json({ script: mapScriptRow(existing) });
      return;
    }

    updates.push(`updated_by = $${paramIndex++}`);
    values.push(memberEmail);

    values.push(scriptId, teamId);

    const result = await query<ScriptRow>(
      `UPDATE scripts SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex++} AND team_id = $${paramIndex} RETURNING *`,
      values
    );

    const script = mapScriptRow(result[0]);

    // Log audit event
    await auditService.log({
      action: 'SCRIPT_UPDATE',
      teamId: teamId!,
      memberEmail: memberEmail!,
      memberDisplayName: req.user?.displayName,
      resourceType: 'script',
      resourceId: script.id,
      metadata: { name: script.name }
    });

    res.json({ script });
  })
);

/**
 * DELETE /teams/:teamId/scripts/:scriptId
 * Delete a script (member can only delete own scripts, admin/owner can delete any)
 */
teamScriptsRouter.delete(
  '/:scriptId',
  requireTeamRole('member'),
  requireResourceOwnership('scripts', 'delete', getScriptOwner),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    const { teamId, memberEmail } = req;
    const { scriptId } = req.params;

    // Check script exists and get details for audit
    const existing = await queryOne<ScriptRow>(
      'SELECT * FROM scripts WHERE id = $1 AND team_id = $2',
      [scriptId, teamId]
    );

    if (!existing) {
      throw new AppError('Script not found', 404, 'SCRIPT_NOT_FOUND');
    }

    await execute('DELETE FROM scripts WHERE id = $1', [scriptId]);

    // Log audit event
    await auditService.log({
      action: 'SCRIPT_DELETE',
      teamId: teamId!,
      memberEmail: memberEmail!,
      memberDisplayName: req.user?.displayName,
      resourceType: 'script',
      resourceId: scriptId,
      metadata: { name: existing.name }
    });

    res.status(204).send();
  })
);
