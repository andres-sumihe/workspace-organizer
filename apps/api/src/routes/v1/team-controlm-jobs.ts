/**
 * Team-scoped Control-M jobs routes
 * 
 * All routes require team membership and respect RBAC permissions.
 * Jobs are scoped to teams via team_id in the database.
 */

import { Router } from 'express';

import { query, queryOne, execute } from '../../db/shared-client.js';
import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireTeamRole } from '../../middleware/team-rbac.middleware.js';
import { parsePaginationQuery } from '../../schemas/pagination.js';
import { auditService } from '../../services/audit.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

import type { TeamAuthenticatedRequest } from '../../middleware/team-rbac.middleware.js';
import type { RequestHandler, Response } from 'express';

export const teamControlmJobsRouter = Router({ mergeParams: true });

// All routes require authentication
teamControlmJobsRouter.use(requireAuth as RequestHandler);

// Database row types
interface JobRow {
  id: string;
  job_id: number;
  application: string;
  group_name: string;
  mem_name: string | null;
  job_name: string;
  description: string | null;
  node_id: string;
  owner: string | null;
  task_type: string;
  is_cyclic: boolean;
  priority: string | null;
  is_critical: boolean;
  days_calendar: string | null;
  weeks_calendar: string | null;
  from_time: string | null;
  to_time: string | null;
  interval_value: string | null;
  mem_lib: string | null;
  author: string | null;
  creation_user: string | null;
  creation_date: string | null;
  change_user_id: string | null;
  change_date: string | null;
  is_active: boolean;
  linked_script_id: string | null;
  created_at: string;
  updated_at: string;
}

// Map row to response object
const mapJobRow = (row: JobRow) => ({
  id: row.id,
  jobId: row.job_id,
  application: row.application,
  groupName: row.group_name,
  memName: row.mem_name ?? undefined,
  jobName: row.job_name,
  description: row.description ?? undefined,
  nodeId: row.node_id,
  owner: row.owner ?? undefined,
  taskType: row.task_type,
  isCyclic: row.is_cyclic,
  priority: row.priority ?? undefined,
  isCritical: row.is_critical,
  daysCalendar: row.days_calendar ?? undefined,
  weeksCalendar: row.weeks_calendar ?? undefined,
  fromTime: row.from_time ?? undefined,
  toTime: row.to_time ?? undefined,
  intervalValue: row.interval_value ?? undefined,
  memLib: row.mem_lib ?? undefined,
  author: row.author ?? undefined,
  creationUser: row.creation_user ?? undefined,
  creationDate: row.creation_date ?? undefined,
  changeUserId: row.change_user_id ?? undefined,
  changeDate: row.change_date ?? undefined,
  isActive: row.is_active,
  linkedScriptId: row.linked_script_id ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

/**
 * GET /teams/:teamId/controlm-jobs
 * List Control-M jobs for the team (requires membership)
 * 
 * Note: Currently jobs are not team-scoped in the database.
 * This endpoint lists all jobs but requires team membership.
 * Future migration will add team_id to controlm_jobs table.
 */
teamControlmJobsRouter.get('/', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const pagination = parsePaginationQuery(req.query);
  
  const application = typeof req.query.application === 'string' ? req.query.application : undefined;
  const groupName = typeof req.query.groupName === 'string' ? req.query.groupName : undefined;
  const nodeId = typeof req.query.nodeId === 'string' ? req.query.nodeId : undefined;
  const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
  const searchQuery = typeof req.query.searchQuery === 'string' ? req.query.searchQuery : undefined;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (application !== undefined) {
    conditions.push(`application = $${paramIndex++}`);
    values.push(application);
  }

  if (groupName !== undefined) {
    conditions.push(`group_name = $${paramIndex++}`);
    values.push(groupName);
  }

  if (nodeId !== undefined) {
    conditions.push(`node_id = $${paramIndex++}`);
    values.push(nodeId);
  }

  if (isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    values.push(isActive);
  }

  if (searchQuery !== undefined && searchQuery.trim() !== '') {
    conditions.push(`(job_name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR mem_name ILIKE $${paramIndex})`);
    values.push(`%${searchQuery}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(1) as count FROM controlm_jobs ${whereClause}`,
    values
  );
  const total = countResult ? parseInt(countResult.count, 10) : 0;

  // Get items
  const limit = pagination.pageSize;
  const offset = (pagination.page - 1) * pagination.pageSize;
  values.push(limit, offset);

  const rows = await query<JobRow>(
    `SELECT * FROM controlm_jobs ${whereClause} ORDER BY job_name LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );

  const items = rows.map(mapJobRow);

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
 * GET /teams/:teamId/controlm-jobs/stats
 * Get job statistics (requires membership)
 */
teamControlmJobsRouter.get('/stats', requireTeamRole('member'), asyncHandler(async (_req: TeamAuthenticatedRequest, res: Response) => {
  // Total jobs
  const totalResult = await queryOne<{ count: string }>('SELECT COUNT(1) as count FROM controlm_jobs');
  const total = totalResult ? parseInt(totalResult.count, 10) : 0;

  // Active jobs
  const activeResult = await queryOne<{ count: string }>('SELECT COUNT(1) as count FROM controlm_jobs WHERE is_active = true');
  const active = activeResult ? parseInt(activeResult.count, 10) : 0;

  // Critical jobs
  const criticalResult = await queryOne<{ count: string }>('SELECT COUNT(1) as count FROM controlm_jobs WHERE is_critical = true');
  const critical = criticalResult ? parseInt(criticalResult.count, 10) : 0;

  // Linked to scripts
  const linkedResult = await queryOne<{ count: string }>('SELECT COUNT(1) as count FROM controlm_jobs WHERE linked_script_id IS NOT NULL');
  const linked = linkedResult ? parseInt(linkedResult.count, 10) : 0;

  // By application
  interface AppCount { application: string; count: string }
  const byApplicationRows = await query<AppCount>(
    'SELECT application, COUNT(1) as count FROM controlm_jobs GROUP BY application ORDER BY count DESC'
  );
  const byApplication = byApplicationRows.map(r => ({ application: r.application, count: parseInt(r.count, 10) }));

  res.json({
    stats: {
      total,
      active,
      critical,
      linked,
      byApplication
    }
  });
}));

/**
 * GET /teams/:teamId/controlm-jobs/filters
 * Get available filter values (requires membership)
 */
teamControlmJobsRouter.get('/filters', requireTeamRole('member'), asyncHandler(async (_req: TeamAuthenticatedRequest, res: Response) => {
  const applications = await query<{ application: string }>(
    'SELECT DISTINCT application FROM controlm_jobs ORDER BY application'
  );

  const groups = await query<{ group_name: string }>(
    'SELECT DISTINCT group_name FROM controlm_jobs ORDER BY group_name'
  );

  const nodes = await query<{ node_id: string }>(
    'SELECT DISTINCT node_id FROM controlm_jobs ORDER BY node_id'
  );

  res.json({
    filters: {
      applications: applications.map(r => r.application),
      groups: groups.map(r => r.group_name),
      nodes: nodes.map(r => r.node_id)
    }
  });
}));

/**
 * GET /teams/:teamId/controlm-jobs/:jobId
 * Get a specific job (requires membership)
 */
teamControlmJobsRouter.get('/:jobId', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { jobId } = req.params;

  const row = await queryOne<JobRow>(
    'SELECT * FROM controlm_jobs WHERE id = $1',
    [jobId]
  );

  if (!row) {
    throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
  }

  res.json({ job: mapJobRow(row) });
}));

/**
 * POST /teams/:teamId/controlm-jobs/:jobId/link-script
 * Link a job to a script (requires admin role)
 */
teamControlmJobsRouter.post('/:jobId/link-script', requireTeamRole('admin'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, memberEmail } = req;
  const { jobId } = req.params;
  const { scriptId } = req.body ?? {};

  if (typeof scriptId !== 'string') {
    throw new AppError('scriptId is required', 400, 'INVALID_REQUEST');
  }

  // Verify job exists
  const job = await queryOne<JobRow>('SELECT * FROM controlm_jobs WHERE id = $1', [jobId]);
  if (!job) {
    throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
  }

  // Verify script exists and belongs to team
  const script = await queryOne<{ id: string; name: string; team_id: string }>(
    'SELECT id, name, team_id FROM scripts WHERE id = $1 AND team_id = $2',
    [scriptId, teamId]
  );

  if (!script) {
    throw new AppError('Script not found or does not belong to this team', 404, 'SCRIPT_NOT_FOUND');
  }

  // Link the job to the script
  await execute(
    'UPDATE controlm_jobs SET linked_script_id = $1, updated_at = NOW() WHERE id = $2',
    [scriptId, jobId]
  );

  // Log audit event
  await auditService.log({
    action: 'JOB_LINK',
    teamId: teamId!,
    memberEmail: memberEmail!,
    memberDisplayName: req.user?.displayName,
    resourceType: 'controlm_job',
    resourceId: jobId,
    metadata: { jobName: job.job_name, scriptId, scriptName: script.name }
  });

  res.json({ success: true, message: 'Job linked to script successfully' });
}));

/**
 * DELETE /teams/:teamId/controlm-jobs/:jobId/link-script
 * Unlink a job from its script (requires admin role)
 */
teamControlmJobsRouter.delete('/:jobId/link-script', requireTeamRole('admin'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, memberEmail } = req;
  const { jobId } = req.params;

  // Verify job exists and get linked script info
  const job = await queryOne<JobRow>('SELECT * FROM controlm_jobs WHERE id = $1', [jobId]);
  if (!job) {
    throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
  }

  if (!job.linked_script_id) {
    throw new AppError('Job is not linked to any script', 400, 'NOT_LINKED');
  }

  // Unlink
  await execute(
    'UPDATE controlm_jobs SET linked_script_id = NULL, updated_at = NOW() WHERE id = $1',
    [jobId]
  );

  // Log audit event
  await auditService.log({
    action: 'JOB_UNLINK',
    teamId: teamId!,
    memberEmail: memberEmail!,
    memberDisplayName: req.user?.displayName,
    resourceType: 'controlm_job',
    resourceId: jobId,
    metadata: { jobName: job.job_name, previousScriptId: job.linked_script_id }
  });

  res.json({ success: true, message: 'Job unlinked from script successfully' });
}));

/**
 * DELETE /teams/:teamId/controlm-jobs/:jobId
 * Delete a job (requires admin role)
 */
teamControlmJobsRouter.delete('/:jobId', requireTeamRole('admin'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, memberEmail } = req;
  const { jobId } = req.params;

  const job = await queryOne<JobRow>('SELECT * FROM controlm_jobs WHERE id = $1', [jobId]);
  if (!job) {
    throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
  }

  await execute('DELETE FROM controlm_jobs WHERE id = $1', [jobId]);

  // Log audit event
  await auditService.log({
    action: 'JOB_DELETE',
    teamId: teamId!,
    memberEmail: memberEmail!,
    memberDisplayName: req.user?.displayName,
    resourceType: 'controlm_job',
    resourceId: jobId,
    metadata: { jobName: job.job_name, application: job.application }
  });

  res.status(204).send();
}));
