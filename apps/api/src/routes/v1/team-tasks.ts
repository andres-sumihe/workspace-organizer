/**
 * Team-scoped tasks routes (nested under projects)
 *
 * All routes require team membership and respect RBAC permissions.
 * Tasks are scoped to team projects with assignee support.
 */

import { Router } from 'express';

import { query, queryOne, execute, getSharedClient } from '../../db/shared-client.js';
import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireTeamRole } from '../../middleware/team-rbac.middleware.js';
import { parsePaginationQuery } from '../../schemas/pagination.js';
import { auditService } from '../../services/audit.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

import type { TeamAuthenticatedRequest } from '../../middleware/team-rbac.middleware.js';
import type { TeamTaskStatus, TeamTaskPriority } from '@workspace/shared';
import type { RequestHandler, Response } from 'express';

export const teamTasksRouter = Router({ mergeParams: true });

teamTasksRouter.use(requireAuth as RequestHandler);

// Database row types
interface TaskRow {
  id: string;
  team_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  flags: string; // JSONB stored as string
  created_by_email: string;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
}

interface AssignmentRow {
  email: string;
  display_name: string | null;
  assigned_at: string;
}

const mapTaskRow = (row: TaskRow, assignees: AssignmentRow[] = []) => {
  let flags: string[] = [];
  try {
    const parsed = typeof row.flags === 'string' ? JSON.parse(row.flags) : row.flags;
    if (Array.isArray(parsed)) flags = parsed;
  } catch { /* ignore parse errors */ }

  return {
    id: row.id,
    teamId: row.team_id,
    projectId: row.project_id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status as TeamTaskStatus,
    priority: row.priority as TeamTaskPriority,
    dueDate: row.due_date ?? undefined,
    flags,
    assignees: assignees.map(a => ({
      email: a.email,
      displayName: a.display_name ?? undefined,
      assignedAt: a.assigned_at
    })),
    createdByEmail: row.created_by_email,
    updatedByEmail: row.updated_by_email ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

/**
 * Verify the project belongs to the team
 */
const verifyProject = async (projectId: string, teamId: string): Promise<void> => {
  const project = await queryOne<{ id: string }>(
    'SELECT id FROM team_projects WHERE id = $1 AND team_id = $2',
    [projectId, teamId]
  );
  if (!project) {
    throw new AppError('Team project not found', 404, 'TEAM_PROJECT_NOT_FOUND');
  }
};

/**
 * Fetch assignees for a list of task IDs
 */
const fetchAssignees = async (taskIds: string[]): Promise<Map<string, AssignmentRow[]>> => {
  if (taskIds.length === 0) return new Map();

  const placeholders = taskIds.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await query<AssignmentRow & { task_id: string }>(
    `SELECT task_id, email, display_name, assigned_at FROM team_task_assignments WHERE task_id IN (${placeholders}) ORDER BY assigned_at`,
    taskIds
  );

  const map = new Map<string, AssignmentRow[]>();
  for (const row of rows) {
    const list = map.get(row.task_id) ?? [];
    list.push({ email: row.email, display_name: row.display_name, assigned_at: row.assigned_at });
    map.set(row.task_id, list);
  }
  return map;
};

/**
 * Sync task assignments (delete removed, insert new)
 */
const syncAssignments = async (taskId: string, teamId: string, emails: string[]): Promise<void> => {
  const client = await getSharedClient();
  try {
    await client.query('BEGIN');

    // Remove existing assignments
    await client.query('DELETE FROM team_task_assignments WHERE task_id = $1', [taskId]);

    // Insert new assignments with display names from team_members
    for (const email of emails) {
      const member = await client.query<{ display_name: string | null }>(
        'SELECT display_name FROM team_members WHERE team_id = $1 AND email = $2',
        [teamId, email]
      );
      const displayName = member.rows[0]?.display_name ?? null;

      await client.query(
        'INSERT INTO team_task_assignments (task_id, email, display_name) VALUES ($1, $2, $3)',
        [taskId, email, displayName]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * GET /teams/:teamId/projects/:projectId/tasks
 * List tasks for a team project
 */
teamTasksRouter.get('/', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId } = req;
  const projectId = req.params.projectId as string;
  const pagination = parsePaginationQuery(req.query);

  await verifyProject(projectId, teamId!);

  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const priority = typeof req.query.priority === 'string' ? req.query.priority : undefined;
  const assignee = typeof req.query.assignee === 'string' ? req.query.assignee : undefined;
  const searchQuery = typeof req.query.searchQuery === 'string' ? req.query.searchQuery : undefined;

  const conditions: string[] = ['t.project_id = $1', 't.team_id = $2'];
  const values: unknown[] = [projectId, teamId];
  let paramIndex = 3;

  if (status) { conditions.push(`t.status = $${paramIndex++}`); values.push(status); }
  if (priority) { conditions.push(`t.priority = $${paramIndex++}`); values.push(priority); }
  if (assignee) {
    conditions.push(`EXISTS (SELECT 1 FROM team_task_assignments a WHERE a.task_id = t.id AND a.email = $${paramIndex++})`);
    values.push(assignee);
  }
  if (searchQuery && searchQuery.trim() !== '') {
    conditions.push(`(t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
    values.push(`%${searchQuery}%`);
    paramIndex++;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(1) as count FROM team_tasks t ${whereClause}`,
    values
  );
  const total = countResult ? parseInt(countResult.count, 10) : 0;

  const limit = pagination.pageSize;
  const offset = (pagination.page - 1) * pagination.pageSize;
  values.push(limit, offset);

  const rows = await query<TaskRow>(
    `SELECT t.* FROM team_tasks t ${whereClause} ORDER BY t.priority DESC, t.due_date ASC NULLS LAST, t.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );

  // Fetch assignees for all tasks
  const assigneesMap = await fetchAssignees(rows.map(r => r.id));
  const items = rows.map(row => mapTaskRow(row, assigneesMap.get(row.id) ?? []));

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
 * GET /teams/:teamId/projects/:projectId/tasks/:taskId
 * Get a specific task
 */
teamTasksRouter.get('/:taskId', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId } = req;
  const projectId = req.params.projectId as string;
  const taskId = req.params.taskId as string;

  await verifyProject(projectId, teamId!);

  const row = await queryOne<TaskRow>(
    'SELECT * FROM team_tasks WHERE id = $1 AND project_id = $2 AND team_id = $3',
    [taskId, projectId, teamId]
  );

  if (!row) {
    throw new AppError('Team task not found', 404, 'TEAM_TASK_NOT_FOUND');
  }

  const assigneesMap = await fetchAssignees([taskId]);
  res.json({ task: mapTaskRow(row, assigneesMap.get(taskId) ?? []) });
}));

/**
 * POST /teams/:teamId/projects/:projectId/tasks
 * Create a new team task
 */
teamTasksRouter.post('/', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, memberEmail } = req;
  const projectId = req.params.projectId as string;
  const body = (req.body ?? {}) as Record<string, unknown>;

  await verifyProject(projectId, teamId!);

  const title = typeof body.title === 'string' ? body.title : undefined;
  const description = typeof body.description === 'string' ? body.description : null;
  const status = typeof body.status === 'string' ? body.status : 'pending';
  const priority = typeof body.priority === 'string' ? body.priority : 'medium';
  const dueDate = typeof body.dueDate === 'string' ? body.dueDate : null;
  const assigneeEmails = Array.isArray(body.assigneeEmails)
    ? body.assigneeEmails.filter((e): e is string => typeof e === 'string')
    : [];

  if (!title) {
    throw new AppError('Title is required', 400, 'INVALID_REQUEST');
  }

  const result = await query<TaskRow>(
    `INSERT INTO team_tasks (team_id, project_id, title, description, status, priority, due_date, created_by_email, updated_by_email)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     RETURNING *`,
    [teamId, projectId, title, description, status, priority, dueDate, memberEmail]
  );

  const task = result[0];

  // Sync assignments
  if (assigneeEmails.length > 0) {
    await syncAssignments(task.id, teamId!, assigneeEmails);
  }

  const assigneesMap = await fetchAssignees([task.id]);

  await auditService.log({
    action: 'TEAM_TASK_CREATE',
    teamId: teamId!,
    memberEmail: memberEmail!,
    memberDisplayName: req.user?.displayName,
    resourceType: 'team_task',
    resourceId: task.id,
    metadata: { title: task.title, projectId }
  });

  res.status(201).json({ task: mapTaskRow(task, assigneesMap.get(task.id) ?? []) });
}));

/**
 * PATCH /teams/:teamId/projects/:projectId/tasks/:taskId
 * Update a team task
 */
teamTasksRouter.patch('/:taskId', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, teamRole, memberEmail } = req;
  const projectId = req.params.projectId as string;
  const taskId = req.params.taskId as string;
  const body = (req.body ?? {}) as Record<string, unknown>;

  await verifyProject(projectId, teamId!);

  const existing = await queryOne<TaskRow>(
    'SELECT * FROM team_tasks WHERE id = $1 AND project_id = $2 AND team_id = $3',
    [taskId, projectId, teamId]
  );

  if (!existing) {
    throw new AppError('Team task not found', 404, 'TEAM_TASK_NOT_FOUND');
  }

  // Members can only update tasks they created or are assigned to
  if (teamRole === 'member') {
    const isCreator = existing.created_by_email === memberEmail;
    const isAssignee = await queryOne<{ email: string }>(
      'SELECT email FROM team_task_assignments WHERE task_id = $1 AND email = $2',
      [taskId, memberEmail]
    );
    if (!isCreator && !isAssignee) {
      throw new AppError('You can only update tasks you created or are assigned to', 403, 'FORBIDDEN');
    }
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (typeof body.title === 'string') { updates.push(`title = $${paramIndex++}`); values.push(body.title); }
  if (typeof body.description === 'string') { updates.push(`description = $${paramIndex++}`); values.push(body.description); }
  if (typeof body.status === 'string') { updates.push(`status = $${paramIndex++}`); values.push(body.status); }
  if (typeof body.priority === 'string') { updates.push(`priority = $${paramIndex++}`); values.push(body.priority); }
  if (typeof body.dueDate === 'string') { updates.push(`due_date = $${paramIndex++}`); values.push(body.dueDate); }
  if (Array.isArray(body.flags)) { updates.push(`flags = $${paramIndex++}`); values.push(JSON.stringify(body.flags)); }

  // Handle assignments (admin+ can reassign any, members can only self-assign)
  if (Array.isArray(body.assigneeEmails)) {
    const emails = body.assigneeEmails.filter((e): e is string => typeof e === 'string');
    await syncAssignments(taskId, teamId!, emails);
  }

  if (updates.length === 0 && !Array.isArray(body.assigneeEmails)) {
    const assigneesMap = await fetchAssignees([taskId]);
    res.json({ task: mapTaskRow(existing, assigneesMap.get(taskId) ?? []) });
    return;
  }

  if (updates.length > 0) {
    updates.push(`updated_by_email = $${paramIndex++}`);
    values.push(memberEmail);
    values.push(taskId, projectId, teamId);

    await query<TaskRow>(
      `UPDATE team_tasks SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex++} AND project_id = $${paramIndex++} AND team_id = $${paramIndex} RETURNING *`,
      values
    );
  }

  // Re-fetch for consistent response
  const updated = await queryOne<TaskRow>(
    'SELECT * FROM team_tasks WHERE id = $1 AND project_id = $2 AND team_id = $3',
    [taskId, projectId, teamId]
  );

  const assigneesMap = await fetchAssignees([taskId]);

  await auditService.log({
    action: 'TEAM_TASK_UPDATE',
    teamId: teamId!,
    memberEmail: memberEmail!,
    memberDisplayName: req.user?.displayName,
    resourceType: 'team_task',
    resourceId: taskId,
    metadata: { title: updated?.title ?? existing.title, projectId }
  });

  res.json({ task: mapTaskRow(updated ?? existing, assigneesMap.get(taskId) ?? []) });
}));

/**
 * DELETE /teams/:teamId/projects/:projectId/tasks/:taskId
 * Delete a team task (admin+ or creator)
 */
teamTasksRouter.delete('/:taskId', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, teamRole, memberEmail } = req;
  const projectId = req.params.projectId as string;
  const taskId = req.params.taskId as string;

  await verifyProject(projectId, teamId!);

  const existing = await queryOne<TaskRow>(
    'SELECT * FROM team_tasks WHERE id = $1 AND project_id = $2 AND team_id = $3',
    [taskId, projectId, teamId]
  );

  if (!existing) {
    throw new AppError('Team task not found', 404, 'TEAM_TASK_NOT_FOUND');
  }

  // Members can only delete their own tasks
  if (teamRole === 'member' && existing.created_by_email !== memberEmail) {
    throw new AppError('You can only delete tasks you created', 403, 'FORBIDDEN');
  }

  await execute(
    'DELETE FROM team_tasks WHERE id = $1 AND project_id = $2 AND team_id = $3',
    [taskId, projectId, teamId]
  );

  await auditService.log({
    action: 'TEAM_TASK_DELETE',
    teamId: teamId!,
    memberEmail: memberEmail!,
    memberDisplayName: req.user?.displayName,
    resourceType: 'team_task',
    resourceId: taskId,
    metadata: { title: existing.title, projectId }
  });

  res.status(204).send();
}));
