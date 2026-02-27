/**
 * Team-scoped projects routes
 *
 * All routes require team membership and respect RBAC permissions.
 * Projects are scoped to teams via team_id in the database.
 */

import { Router } from 'express';

import { query, queryOne, execute } from '../../db/shared-client.js';
import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireTeamRole } from '../../middleware/team-rbac.middleware.js';
import { parsePaginationQuery } from '../../schemas/pagination.js';
import { auditService } from '../../services/audit.service.js';
import { teamEventsService } from '../../services/team-events.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

import type { TeamAuthenticatedRequest } from '../../middleware/team-rbac.middleware.js';
import type { TeamProjectStatus } from '@workspace/shared';
import type { RequestHandler, Response } from 'express';

export const teamProjectsRouter = Router({ mergeParams: true });

teamProjectsRouter.use(requireAuth as RequestHandler);

// Database row type
interface ProjectRow {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  status: string;
  start_date: string | null;
  due_date: string | null;
  actual_end_date: string | null;
  business_proposal_id: string | null;
  change_id: string | null;
  created_by_email: string;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
}

const mapProjectRow = (row: ProjectRow) => ({
  id: row.id,
  teamId: row.team_id,
  title: row.title,
  description: row.description ?? undefined,
  status: row.status as TeamProjectStatus,
  startDate: row.start_date ?? undefined,
  dueDate: row.due_date ?? undefined,
  actualEndDate: row.actual_end_date ?? undefined,
  businessProposalId: row.business_proposal_id ?? undefined,
  changeId: row.change_id ?? undefined,
  createdByEmail: row.created_by_email,
  updatedByEmail: row.updated_by_email ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

/**
 * GET /teams/:teamId/projects
 * List projects for the team (requires membership)
 */
teamProjectsRouter.get('/', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId } = req;
  const pagination = parsePaginationQuery(req.query);

  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const searchQuery = typeof req.query.searchQuery === 'string' ? req.query.searchQuery : undefined;

  const conditions: string[] = ['p.team_id = $1'];
  const values: unknown[] = [teamId];
  let paramIndex = 2;

  if (status) {
    conditions.push(`p.status = $${paramIndex++}`);
    values.push(status);
  }

  if (searchQuery && searchQuery.trim() !== '') {
    conditions.push(`(p.title ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`);
    values.push(`%${searchQuery}%`);
    paramIndex++;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // Count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(1) as count FROM team_projects p ${whereClause}`,
    values
  );
  const total = countResult ? parseInt(countResult.count, 10) : 0;

  // Items with task stats and note count
  const limit = pagination.pageSize;
  const offset = (pagination.page - 1) * pagination.pageSize;
  values.push(limit, offset);

  const rows = await query<ProjectRow & { note_count: string; task_total: string; task_completed: string; task_in_progress: string; task_pending: string }>(
    `SELECT p.*,
       COALESCE(ns.note_count, '0') AS note_count,
       COALESCE(ts.task_total, '0') AS task_total,
       COALESCE(ts.task_completed, '0') AS task_completed,
       COALESCE(ts.task_in_progress, '0') AS task_in_progress,
       COALESCE(ts.task_pending, '0') AS task_pending
     FROM team_projects p
     LEFT JOIN LATERAL (
       SELECT COUNT(1)::text AS note_count FROM team_notes WHERE project_id = p.id
     ) ns ON true
     LEFT JOIN LATERAL (
       SELECT
         COUNT(1)::text AS task_total,
         COUNT(1) FILTER (WHERE status = 'completed')::text AS task_completed,
         COUNT(1) FILTER (WHERE status = 'in_progress')::text AS task_in_progress,
         COUNT(1) FILTER (WHERE status = 'pending')::text AS task_pending
       FROM team_tasks WHERE project_id = p.id
     ) ts ON true
     ${whereClause}
     ORDER BY p.updated_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );

  const items = rows.map(row => ({
    ...mapProjectRow(row),
    noteCount: parseInt(String(row.note_count), 10),
    taskStats: {
      total: parseInt(String(row.task_total), 10),
      completed: parseInt(String(row.task_completed), 10),
      inProgress: parseInt(String(row.task_in_progress), 10),
      pending: parseInt(String(row.task_pending), 10)
    }
  }));

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
 * GET /teams/:teamId/projects/:projectId
 * Get a specific project (requires membership)
 */
teamProjectsRouter.get('/:projectId', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId } = req;
  const { projectId } = req.params;

  const row = await queryOne<ProjectRow>(
    'SELECT * FROM team_projects WHERE id = $1 AND team_id = $2',
    [projectId, teamId]
  );

  if (!row) {
    throw new AppError('Team project not found', 404, 'TEAM_PROJECT_NOT_FOUND');
  }

  res.json({ project: mapProjectRow(row) });
}));

/**
 * POST /teams/:teamId/projects
 * Create a new team project (admin+ can create)
 */
teamProjectsRouter.post('/', requireTeamRole('admin'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, memberEmail } = req;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const title = typeof body.title === 'string' ? body.title : undefined;
  const description = typeof body.description === 'string' ? body.description : undefined;
  const status = typeof body.status === 'string' ? body.status : 'active';
  const startDate = typeof body.startDate === 'string' ? body.startDate : null;
  const dueDate = typeof body.dueDate === 'string' ? body.dueDate : null;
  const businessProposalId = typeof body.businessProposalId === 'string' ? body.businessProposalId : null;
  const changeId = typeof body.changeId === 'string' ? body.changeId : null;

  if (!title) {
    throw new AppError('Title is required', 400, 'INVALID_REQUEST');
  }

  const result = await query<ProjectRow>(
    `INSERT INTO team_projects (team_id, title, description, status, start_date, due_date, business_proposal_id, change_id, created_by_email, updated_by_email)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
     RETURNING *`,
    [teamId, title, description ?? null, status, startDate, dueDate, businessProposalId, changeId, memberEmail]
  );

  const project = mapProjectRow(result[0]);

  await auditService.log({
    action: 'TEAM_PROJECT_CREATE',
    teamId: teamId!,
    memberEmail: memberEmail!,
    memberDisplayName: req.user?.displayName,
    resourceType: 'team_project',
    resourceId: project.id,
    metadata: { title: project.title }
  });

  void teamEventsService.broadcast({ teamId: teamId!, resource: 'project', action: 'created', resourceId: project.id, actorEmail: memberEmail });

  res.status(201).json({ project });
}));

/**
 * PATCH /teams/:teamId/projects/:projectId
 * Update a project (admin+ can update any)
 */
teamProjectsRouter.patch('/:projectId', requireTeamRole('admin'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, memberEmail } = req;
  const { projectId } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const existing = await queryOne<ProjectRow>(
    'SELECT * FROM team_projects WHERE id = $1 AND team_id = $2',
    [projectId, teamId]
  );

  if (!existing) {
    throw new AppError('Team project not found', 404, 'TEAM_PROJECT_NOT_FOUND');
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (typeof body.title === 'string') { updates.push(`title = $${paramIndex++}`); values.push(body.title); }
  if (typeof body.description === 'string') { updates.push(`description = $${paramIndex++}`); values.push(body.description); }
  if (typeof body.status === 'string') { updates.push(`status = $${paramIndex++}`); values.push(body.status); }
  if (typeof body.startDate === 'string') { updates.push(`start_date = $${paramIndex++}`); values.push(body.startDate); }
  if (typeof body.dueDate === 'string') { updates.push(`due_date = $${paramIndex++}`); values.push(body.dueDate); }
  if (typeof body.actualEndDate === 'string') { updates.push(`actual_end_date = $${paramIndex++}`); values.push(body.actualEndDate); }
  if (typeof body.businessProposalId === 'string') { updates.push(`business_proposal_id = $${paramIndex++}`); values.push(body.businessProposalId); }
  if (typeof body.changeId === 'string') { updates.push(`change_id = $${paramIndex++}`); values.push(body.changeId); }

  if (updates.length === 0) {
    res.json({ project: mapProjectRow(existing) });
    return;
  }

  updates.push(`updated_by_email = $${paramIndex++}`);
  values.push(memberEmail);
  values.push(projectId, teamId);

  const result = await query<ProjectRow>(
    `UPDATE team_projects SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex++} AND team_id = $${paramIndex} RETURNING *`,
    values
  );

  const project = mapProjectRow(result[0]);

  await auditService.log({
    action: 'TEAM_PROJECT_UPDATE',
    teamId: teamId!,
    memberEmail: memberEmail!,
    memberDisplayName: req.user?.displayName,
    resourceType: 'team_project',
    resourceId: project.id,
    metadata: { title: project.title }
  });

  void teamEventsService.broadcast({ teamId: teamId!, resource: 'project', action: 'updated', resourceId: project.id, actorEmail: memberEmail });

  res.json({ project });
}));

/**
 * DELETE /teams/:teamId/projects/:projectId
 * Delete a project (admin+ can delete)
 */
teamProjectsRouter.delete('/:projectId', requireTeamRole('admin'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, memberEmail } = req;
  const { projectId } = req.params;

  const existing = await queryOne<ProjectRow>(
    'SELECT * FROM team_projects WHERE id = $1 AND team_id = $2',
    [projectId, teamId]
  );

  if (!existing) {
    throw new AppError('Team project not found', 404, 'TEAM_PROJECT_NOT_FOUND');
  }

  await execute(
    'DELETE FROM team_projects WHERE id = $1 AND team_id = $2',
    [projectId, teamId]
  );

  await auditService.log({
    action: 'TEAM_PROJECT_DELETE',
    teamId: teamId!,
    memberEmail: memberEmail!,
    memberDisplayName: req.user?.displayName,
    resourceType: 'team_project',
    resourceId: existing.id,
    metadata: { title: existing.title }
  });

  void teamEventsService.broadcast({ teamId: teamId!, resource: 'project', action: 'deleted', resourceId: existing.id, actorEmail: memberEmail });

  res.status(204).send();
}));
