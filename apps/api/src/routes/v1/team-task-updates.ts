/**
 * Team task updates routes (nested under tasks)
 *
 * All routes require team membership.
 * Updates support threaded replies and creator-only edit/delete.
 */

import { Router } from 'express';

import { query, queryOne, execute } from '../../db/shared-client.js';
import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireTeamRole } from '../../middleware/team-rbac.middleware.js';
import { teamEventsService } from '../../services/team-events.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

import type { TeamAuthenticatedRequest } from '../../middleware/team-rbac.middleware.js';
import type { RequestHandler, Response } from 'express';

export const teamTaskUpdatesRouter = Router({ mergeParams: true });

teamTaskUpdatesRouter.use(requireAuth as RequestHandler);

// Database row type
interface UpdateRow {
  id: string;
  team_id: string;
  task_id: string;
  parent_id: string | null;
  content: string;
  created_by_email: string;
  created_by_display_name: string | null;
  created_at: string;
  updated_at: string;
}

interface MappedUpdate {
  id: string;
  teamId: string;
  taskId: string;
  parentId?: string;
  content: string;
  createdByEmail: string;
  createdByDisplayName?: string;
  replies?: MappedUpdate[];
  createdAt: string;
  updatedAt: string;
}

const mapRow = (row: UpdateRow): MappedUpdate => ({
  id: row.id,
  teamId: row.team_id,
  taskId: row.task_id,
  parentId: row.parent_id ?? undefined,
  content: row.content,
  createdByEmail: row.created_by_email,
  createdByDisplayName: row.created_by_display_name ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * Verify task belongs to the team/project
 */
const verifyTask = async (taskId: string, projectId: string, teamId: string): Promise<void> => {
  const task = await queryOne<{ id: string }>(
    'SELECT id FROM team_tasks WHERE id = $1 AND project_id = $2 AND team_id = $3',
    [taskId, projectId, teamId]
  );
  if (!task) {
    throw new AppError('Team task not found', 404, 'TEAM_TASK_NOT_FOUND');
  }
};

/**
 * GET /teams/:teamId/projects/:projectId/tasks/:taskId/updates
 * List updates for a task (threaded: top-level with nested replies)
 */
teamTaskUpdatesRouter.get('/', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId } = req;
  const projectId = req.params.projectId as string;
  const taskId = req.params.taskId as string;

  await verifyTask(taskId, projectId, teamId!);

  // Fetch all updates for this task
  const rows = await query<UpdateRow>(
    'SELECT * FROM team_task_updates WHERE task_id = $1 AND team_id = $2 ORDER BY created_at ASC',
    [taskId, teamId]
  );

  // Build threaded structure
  const topLevel: MappedUpdate[] = [];
  const repliesMap = new Map<string, MappedUpdate[]>();

  for (const row of rows) {
    const mapped = mapRow(row);
    if (row.parent_id) {
      const list = repliesMap.get(row.parent_id) ?? [];
      list.push(mapped);
      repliesMap.set(row.parent_id, list);
    } else {
      topLevel.push(mapped);
    }
  }

  // Attach replies to their parents
  for (const update of topLevel) {
    update.replies = repliesMap.get(update.id) ?? [];
  }

  res.json({ items: topLevel });
}));

/**
 * POST /teams/:teamId/projects/:projectId/tasks/:taskId/updates
 * Create a new update (or reply)
 */
teamTaskUpdatesRouter.post('/', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, memberEmail } = req;
  const projectId = req.params.projectId as string;
  const taskId = req.params.taskId as string;
  const body = (req.body ?? {}) as Record<string, unknown>;

  await verifyTask(taskId, projectId, teamId!);

  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const parentId = typeof body.parentId === 'string' ? body.parentId : null;

  if (!content) {
    throw new AppError('Content is required', 400, 'INVALID_REQUEST');
  }

  // If replying, verify parent exists and belongs to this task
  if (parentId) {
    const parent = await queryOne<{ id: string }>(
      'SELECT id FROM team_task_updates WHERE id = $1 AND task_id = $2',
      [parentId, taskId]
    );
    if (!parent) {
      throw new AppError('Parent update not found', 404, 'PARENT_NOT_FOUND');
    }
  }

  // Get display name from team_members
  const member = await queryOne<{ display_name: string | null }>(
    'SELECT display_name FROM team_members WHERE team_id = $1 AND email = $2',
    [teamId, memberEmail]
  );

  const rows = await query<UpdateRow>(
    `INSERT INTO team_task_updates (team_id, task_id, parent_id, content, created_by_email, created_by_display_name)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [teamId, taskId, parentId, content, memberEmail, member?.display_name ?? null]
  );

  void teamEventsService.broadcast({ teamId: teamId!, resource: 'taskUpdate', action: 'created', resourceId: rows[0].id, parentId: taskId, grandParentId: projectId, actorEmail: memberEmail });

  res.status(201).json({ update: mapRow(rows[0]) });
}));

/**
 * PATCH /teams/:teamId/projects/:projectId/tasks/:taskId/updates/:updateId
 * Update content (creator only)
 */
teamTaskUpdatesRouter.patch('/:updateId', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, memberEmail } = req;
  const projectId = req.params.projectId as string;
  const taskId = req.params.taskId as string;
  const updateId = req.params.updateId as string;
  const body = (req.body ?? {}) as Record<string, unknown>;

  await verifyTask(taskId, projectId, teamId!);

  const existing = await queryOne<UpdateRow>(
    'SELECT * FROM team_task_updates WHERE id = $1 AND task_id = $2 AND team_id = $3',
    [updateId, taskId, teamId]
  );

  if (!existing) {
    throw new AppError('Update not found', 404, 'UPDATE_NOT_FOUND');
  }

  // Only creator can edit
  if (existing.created_by_email !== memberEmail) {
    throw new AppError('You can only edit your own updates', 403, 'FORBIDDEN');
  }

  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) {
    throw new AppError('Content is required', 400, 'INVALID_REQUEST');
  }

  const rows = await query<UpdateRow>(
    'UPDATE team_task_updates SET content = $1 WHERE id = $2 RETURNING *',
    [content, updateId]
  );

  void teamEventsService.broadcast({ teamId: teamId!, resource: 'taskUpdate', action: 'updated', resourceId: updateId, parentId: taskId, grandParentId: projectId, actorEmail: memberEmail });

  res.json({ update: mapRow(rows[0]) });
}));

/**
 * DELETE /teams/:teamId/projects/:projectId/tasks/:taskId/updates/:updateId
 * Delete an update (creator only, or admin+)
 */
teamTaskUpdatesRouter.delete('/:updateId', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, teamRole, memberEmail } = req;
  const projectId = req.params.projectId as string;
  const taskId = req.params.taskId as string;
  const updateId = req.params.updateId as string;

  await verifyTask(taskId, projectId, teamId!);

  const existing = await queryOne<UpdateRow>(
    'SELECT * FROM team_task_updates WHERE id = $1 AND task_id = $2 AND team_id = $3',
    [updateId, taskId, teamId]
  );

  if (!existing) {
    throw new AppError('Update not found', 404, 'UPDATE_NOT_FOUND');
  }

  // Only creator or admin+ can delete
  if (teamRole === 'member' && existing.created_by_email !== memberEmail) {
    throw new AppError('You can only delete your own updates', 403, 'FORBIDDEN');
  }

  await execute(
    'DELETE FROM team_task_updates WHERE id = $1 AND task_id = $2 AND team_id = $3',
    [updateId, taskId, teamId]
  );

  void teamEventsService.broadcast({ teamId: teamId!, resource: 'taskUpdate', action: 'deleted', resourceId: updateId, parentId: taskId, grandParentId: projectId, actorEmail: memberEmail });

  res.status(204).end();
}));
