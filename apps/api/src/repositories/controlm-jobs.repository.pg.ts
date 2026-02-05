/**
 * Control-M Jobs repository for PostgreSQL shared database.
 *
 * This repository replaces the SQLite version and works with the shared PostgreSQL database.
 */

import { query, queryOne, execute, getSharedClient } from '../db/shared-client.js';

import type {
  ControlMJob,
  ControlMJobCondition,
  ControlMJobDependency,
  ControlMTaskType
} from '@workspace/shared';

// Database row types for PostgreSQL
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

interface DependencyRow {
  id: string;
  predecessor_job_id: string;
  successor_job_id: string;
  condition_type: string;
  created_at: string;
}

interface ConditionRow {
  id: string;
  job_id: string;
  condition_name: string;
  condition_type: string;
  odate: string | null;
  created_at: string;
}

// Map database row to ControlMJob
const mapRowToJob = (row: JobRow): ControlMJob => ({
  id: row.id,
  jobId: row.job_id,
  application: row.application,
  groupName: row.group_name,
  memName: row.mem_name ?? '',
  jobName: row.job_name,
  description: row.description ?? '',
  nodeId: row.node_id,
  owner: row.owner ?? '',
  taskType: row.task_type as ControlMTaskType,
  isCyclic: row.is_cyclic,
  priority: row.priority ?? '',
  isCritical: row.is_critical,
  daysCalendar: row.days_calendar ?? undefined,
  weeksCalendar: row.weeks_calendar ?? undefined,
  fromTime: row.from_time ?? undefined,
  toTime: row.to_time ?? undefined,
  interval: row.interval_value ?? undefined,
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

// Map database row to dependency
const mapRowToDependency = (row: DependencyRow): ControlMJobDependency => ({
  id: row.id,
  predecessorJobId: row.predecessor_job_id,
  successorJobId: row.successor_job_id,
  conditionType: row.condition_type as 'OC' | 'NOTOK' | 'ANY',
  createdAt: row.created_at
});

// Map database row to condition
const mapRowToCondition = (row: ConditionRow): ControlMJobCondition => ({
  id: row.id,
  jobId: row.job_id,
  conditionName: row.condition_name,
  conditionType: row.condition_type as 'IN' | 'OUT',
  odate: row.odate ?? undefined,
  createdAt: row.created_at
});

// ---- List and Count ----

export interface ListJobsParams {
  page: number;
  pageSize: number;
  application?: string;
  nodeId?: string;
  taskType?: string;
  isActive?: boolean;
  searchQuery?: string;
}

export const countJobs = async (params: Omit<ListJobsParams, 'page' | 'pageSize'>): Promise<number> => {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params.application) {
    conditions.push(`application = $${paramIndex++}`);
    values.push(params.application);
  }
  if (params.nodeId) {
    conditions.push(`node_id = $${paramIndex++}`);
    values.push(params.nodeId);
  }
  if (params.taskType) {
    conditions.push(`task_type = $${paramIndex++}`);
    values.push(params.taskType);
  }
  if (params.isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    values.push(params.isActive);
  }
  if (params.searchQuery) {
    conditions.push(`(job_name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR mem_name ILIKE $${paramIndex})`);
    values.push(`%${params.searchQuery}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM controlm_jobs ${whereClause}`,
    values
  );

  return result ? parseInt(result.count, 10) : 0;
};

export const listJobs = async (params: ListJobsParams): Promise<ControlMJob[]> => {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params.application) {
    conditions.push(`application = $${paramIndex++}`);
    values.push(params.application);
  }
  if (params.nodeId) {
    conditions.push(`node_id = $${paramIndex++}`);
    values.push(params.nodeId);
  }
  if (params.taskType) {
    conditions.push(`task_type = $${paramIndex++}`);
    values.push(params.taskType);
  }
  if (params.isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    values.push(params.isActive);
  }
  if (params.searchQuery) {
    conditions.push(`(job_name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR mem_name ILIKE $${paramIndex})`);
    values.push(`%${params.searchQuery}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (params.page - 1) * params.pageSize;

  values.push(params.pageSize, offset);

  const rows = await query<JobRow>(
    `SELECT * FROM controlm_jobs ${whereClause} ORDER BY job_name ASC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );

  return rows.map(mapRowToJob);
};

// ---- Find by ID ----

export const findJobById = async (id: string): Promise<ControlMJob | null> => {
  const row = await queryOne<JobRow>(
    'SELECT * FROM controlm_jobs WHERE id = $1',
    [id]
  );
  return row ? mapRowToJob(row) : null;
};

export const findJobByJobIdAndApp = async (jobId: number, application: string): Promise<ControlMJob | null> => {
  const row = await queryOne<JobRow>(
    'SELECT * FROM controlm_jobs WHERE job_id = $1 AND application = $2',
    [jobId, application]
  );
  return row ? mapRowToJob(row) : null;
};

export const findJobByJobName = async (jobName: string): Promise<ControlMJob | null> => {
  const row = await queryOne<JobRow>(
    'SELECT * FROM controlm_jobs WHERE job_name = $1',
    [jobName]
  );
  return row ? mapRowToJob(row) : null;
};

// ---- Create / Update / Delete ----

export interface CreateJobInput {
  id: string;
  jobId: number;
  application: string;
  groupName: string;
  memName?: string;
  jobName: string;
  description?: string;
  nodeId: string;
  owner?: string;
  taskType?: ControlMTaskType;
  isCyclic?: boolean;
  priority?: string;
  isCritical?: boolean;
  daysCalendar?: string;
  weeksCalendar?: string;
  fromTime?: string;
  toTime?: string;
  interval?: string;
  memLib?: string;
  author?: string;
  creationUser?: string;
  creationDate?: string;
  changeUserId?: string;
  changeDate?: string;
  isActive?: boolean;
  linkedScriptId?: string;
  createdAt: string;
  updatedAt: string;
}

export const createJob = async (input: CreateJobInput): Promise<ControlMJob> => {
  const result = await query<JobRow>(
    `INSERT INTO controlm_jobs (
      id, job_id, application, group_name, mem_name, job_name, description,
      node_id, owner, task_type, is_cyclic, priority, is_critical,
      days_calendar, weeks_calendar, from_time, to_time, interval_value,
      mem_lib, author, creation_user, creation_date, change_user_id, change_date,
      is_active, linked_script_id, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18,
      $19, $20, $21, $22, $23, $24,
      $25, $26, $27, $28
    ) RETURNING *`,
    [
      input.id,
      input.jobId,
      input.application,
      input.groupName,
      input.memName ?? null,
      input.jobName,
      input.description ?? null,
      input.nodeId,
      input.owner ?? null,
      input.taskType ?? 'Job',
      input.isCyclic ?? false,
      input.priority ?? null,
      input.isCritical ?? false,
      input.daysCalendar ?? null,
      input.weeksCalendar ?? null,
      input.fromTime ?? null,
      input.toTime ?? null,
      input.interval ?? null,
      input.memLib ?? null,
      input.author ?? null,
      input.creationUser ?? null,
      input.creationDate ?? null,
      input.changeUserId ?? null,
      input.changeDate ?? null,
      input.isActive !== false,
      input.linkedScriptId ?? null,
      input.createdAt,
      input.updatedAt
    ]
  );

  return mapRowToJob(result[0]);
};

export const updateJob = async (id: string, updates: Partial<CreateJobInput>): Promise<ControlMJob | null> => {
  const existing = await findJobById(id);
  if (!existing) return null;

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.jobName !== undefined) {
    setClauses.push(`job_name = $${paramIndex++}`);
    values.push(updates.jobName);
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(updates.description ?? null);
  }
  if (updates.memName !== undefined) {
    setClauses.push(`mem_name = $${paramIndex++}`);
    values.push(updates.memName ?? null);
  }
  if (updates.memLib !== undefined) {
    setClauses.push(`mem_lib = $${paramIndex++}`);
    values.push(updates.memLib ?? null);
  }
  if (updates.owner !== undefined) {
    setClauses.push(`owner = $${paramIndex++}`);
    values.push(updates.owner ?? null);
  }
  if (updates.taskType !== undefined) {
    setClauses.push(`task_type = $${paramIndex++}`);
    values.push(updates.taskType);
  }
  if (updates.isCyclic !== undefined) {
    setClauses.push(`is_cyclic = $${paramIndex++}`);
    values.push(updates.isCyclic);
  }
  if (updates.priority !== undefined) {
    setClauses.push(`priority = $${paramIndex++}`);
    values.push(updates.priority ?? null);
  }
  if (updates.isCritical !== undefined) {
    setClauses.push(`is_critical = $${paramIndex++}`);
    values.push(updates.isCritical);
  }
  if (updates.daysCalendar !== undefined) {
    setClauses.push(`days_calendar = $${paramIndex++}`);
    values.push(updates.daysCalendar ?? null);
  }
  if (updates.weeksCalendar !== undefined) {
    setClauses.push(`weeks_calendar = $${paramIndex++}`);
    values.push(updates.weeksCalendar ?? null);
  }
  if (updates.fromTime !== undefined) {
    setClauses.push(`from_time = $${paramIndex++}`);
    values.push(updates.fromTime ?? null);
  }
  if (updates.toTime !== undefined) {
    setClauses.push(`to_time = $${paramIndex++}`);
    values.push(updates.toTime ?? null);
  }
  if (updates.interval !== undefined) {
    setClauses.push(`interval_value = $${paramIndex++}`);
    values.push(updates.interval ?? null);
  }
  if (updates.isActive !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`);
    values.push(updates.isActive);
  }
  if (updates.linkedScriptId !== undefined) {
    setClauses.push(`linked_script_id = $${paramIndex++}`);
    values.push(updates.linkedScriptId ?? null);
  }

  if (setClauses.length === 0) {
    return existing;
  }

  setClauses.push('updated_at = NOW()');
  values.push(id);

  const result = await query<JobRow>(
    `UPDATE controlm_jobs SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return result.length > 0 ? mapRowToJob(result[0]) : null;
};

export const deleteJob = async (id: string): Promise<boolean> => {
  const result = await execute('DELETE FROM controlm_jobs WHERE id = $1', [id]);
  return result > 0;
};

export const deleteAllJobs = async (): Promise<number> => {
  return await execute('DELETE FROM controlm_jobs', []);
};

// ---- Dependencies ----

export const createDependency = async (
  id: string,
  predecessorJobId: string,
  successorJobId: string,
  conditionType: string = 'OC',
  createdAt: string
): Promise<ControlMJobDependency> => {
  const result = await query<DependencyRow>(
    `INSERT INTO controlm_job_dependencies (id, predecessor_job_id, successor_job_id, condition_type, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [id, predecessorJobId, successorJobId, conditionType, createdAt]
  );

  if (result.length > 0) {
    return mapRowToDependency(result[0]);
  }

  // If ON CONFLICT triggered, return constructed object
  return {
    id,
    predecessorJobId,
    successorJobId,
    conditionType: conditionType as 'OC' | 'NOTOK' | 'ANY',
    createdAt
  };
};

export const findPredecessors = async (jobId: string): Promise<ControlMJob[]> => {
  const rows = await query<JobRow>(
    `SELECT j.* FROM controlm_jobs j
     INNER JOIN controlm_job_dependencies d ON d.predecessor_job_id = j.id
     WHERE d.successor_job_id = $1`,
    [jobId]
  );

  return rows.map(mapRowToJob);
};

export const findSuccessors = async (jobId: string): Promise<ControlMJob[]> => {
  const rows = await query<JobRow>(
    `SELECT j.* FROM controlm_jobs j
     INNER JOIN controlm_job_dependencies d ON d.successor_job_id = j.id
     WHERE d.predecessor_job_id = $1`,
    [jobId]
  );

  return rows.map(mapRowToJob);
};

export const getAllDependencies = async (): Promise<ControlMJobDependency[]> => {
  const rows = await query<DependencyRow>(
    'SELECT * FROM controlm_job_dependencies'
  );

  return rows.map(mapRowToDependency);
};

export const deleteAllDependencies = async (): Promise<number> => {
  return await execute('DELETE FROM controlm_job_dependencies', []);
};

// ---- Conditions ----

export const createCondition = async (
  id: string,
  jobId: string,
  conditionName: string,
  conditionType: 'IN' | 'OUT',
  odate: string | null,
  createdAt: string
): Promise<ControlMJobCondition> => {
  const result = await query<ConditionRow>(
    `INSERT INTO controlm_job_conditions (id, job_id, condition_name, condition_type, odate, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, jobId, conditionName, conditionType, odate, createdAt]
  );

  return mapRowToCondition(result[0]);
};

export const findConditionsByJobId = async (jobId: string): Promise<ControlMJobCondition[]> => {
  const rows = await query<ConditionRow>(
    'SELECT * FROM controlm_job_conditions WHERE job_id = $1',
    [jobId]
  );

  return rows.map(mapRowToCondition);
};

export const deleteAllConditions = async (): Promise<number> => {
  return await execute('DELETE FROM controlm_job_conditions', []);
};

// ---- Stats / Analysis ----

export const getJobStats = async (): Promise<{
  totalJobs: number;
  activeJobs: number;
  cyclicJobs: number;
  jobsByServer: Record<string, number>;
  jobsByApplication: Record<string, number>;
  jobsByTaskType: Record<string, number>;
}> => {
  const totalResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM controlm_jobs'
  );
  const activeResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM controlm_jobs WHERE is_active = true'
  );
  const cyclicResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM controlm_jobs WHERE is_cyclic = true'
  );

  const serverRows = await query<{ node_id: string; count: string }>(
    'SELECT node_id, COUNT(*) as count FROM controlm_jobs GROUP BY node_id'
  );
  const appRows = await query<{ application: string; count: string }>(
    'SELECT application, COUNT(*) as count FROM controlm_jobs GROUP BY application'
  );
  const typeRows = await query<{ task_type: string; count: string }>(
    'SELECT task_type, COUNT(*) as count FROM controlm_jobs GROUP BY task_type'
  );

  const jobsByServer: Record<string, number> = {};
  const jobsByApplication: Record<string, number> = {};
  const jobsByTaskType: Record<string, number> = {};

  for (const row of serverRows) {
    jobsByServer[row.node_id] = parseInt(row.count, 10);
  }
  for (const row of appRows) {
    jobsByApplication[row.application] = parseInt(row.count, 10);
  }
  for (const row of typeRows) {
    jobsByTaskType[row.task_type] = parseInt(row.count, 10);
  }

  return {
    totalJobs: totalResult ? parseInt(totalResult.count, 10) : 0,
    activeJobs: activeResult ? parseInt(activeResult.count, 10) : 0,
    cyclicJobs: cyclicResult ? parseInt(cyclicResult.count, 10) : 0,
    jobsByServer,
    jobsByApplication,
    jobsByTaskType
  };
};

// ---- Distinct values for filters ----

export const getDistinctApplications = async (): Promise<string[]> => {
  const rows = await query<{ application: string }>(
    'SELECT DISTINCT application FROM controlm_jobs ORDER BY application'
  );
  return rows.map((r) => r.application);
};

export const getDistinctNodes = async (): Promise<string[]> => {
  const rows = await query<{ node_id: string }>(
    'SELECT DISTINCT node_id FROM controlm_jobs ORDER BY node_id'
  );
  return rows.map((r) => r.node_id);
};

// ---- Get all jobs for graph ----

export const getAllJobs = async (): Promise<ControlMJob[]> => {
  const rows = await query<JobRow>(
    'SELECT * FROM controlm_jobs ORDER BY job_name ASC'
  );
  return rows.map(mapRowToJob);
};

// ---- Script Linking ----

export const linkJobToScript = async (jobId: string, scriptId: string | null): Promise<ControlMJob | null> => {
  const result = await query<JobRow>(
    'UPDATE controlm_jobs SET linked_script_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [scriptId, jobId]
  );
  return result.length > 0 ? mapRowToJob(result[0]) : null;
};

export const getJobsWithUnlinkedScripts = async (): Promise<ControlMJob[]> => {
  const rows = await query<JobRow>(
    `SELECT * FROM controlm_jobs 
     WHERE mem_name IS NOT NULL 
       AND mem_name != '' 
       AND linked_script_id IS NULL
     ORDER BY job_name ASC`
  );

  return rows.map(mapRowToJob);
};

export const getJobsWithLinkedScripts = async (): Promise<ControlMJob[]> => {
  const rows = await query<JobRow>(
    `SELECT * FROM controlm_jobs 
     WHERE linked_script_id IS NOT NULL
     ORDER BY job_name ASC`
  );

  return rows.map(mapRowToJob);
};

export const bulkLinkJobsToScripts = async (links: Array<{ jobId: string; scriptId: string }>): Promise<number> => {
  const client = await getSharedClient();
  let linkedCount = 0;

  try {
    await client.query('BEGIN');

    for (const { jobId, scriptId } of links) {
      const result = await client.query(
        'UPDATE controlm_jobs SET linked_script_id = $1, updated_at = NOW() WHERE id = $2',
        [scriptId, jobId]
      );
      if ((result.rowCount ?? 0) > 0) {
        linkedCount++;
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return linkedCount;
};

export const getJobsByScriptId = async (scriptId: string): Promise<ControlMJob[]> => {
  const rows = await query<JobRow>(
    `SELECT * FROM controlm_jobs 
     WHERE linked_script_id = $1
     ORDER BY job_name ASC`,
    [scriptId]
  );

  return rows.map(mapRowToJob);
};
