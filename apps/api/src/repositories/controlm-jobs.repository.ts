import { getDb } from '../db/client.js';

import type {
  ControlMJob,
  ControlMJobCondition,
  ControlMJobDependency,
  ControlMTaskType
} from '@workspace/shared';

// Row types for database queries
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
  is_cyclic: number;
  priority: string | null;
  is_critical: number;
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
  is_active: number;
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

const isJobRow = (row: unknown): row is JobRow => {
  return (
    row !== null &&
    typeof row === 'object' &&
    'id' in row &&
    'job_id' in row &&
    'job_name' in row
  );
};

const isDependencyRow = (row: unknown): row is DependencyRow => {
  return (
    row !== null &&
    typeof row === 'object' &&
    'id' in row &&
    'predecessor_job_id' in row &&
    'successor_job_id' in row
  );
};

const isConditionRow = (row: unknown): row is ConditionRow => {
  return (
    row !== null &&
    typeof row === 'object' &&
    'id' in row &&
    'job_id' in row &&
    'condition_name' in row
  );
};

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
  isCyclic: row.is_cyclic === 1,
  priority: row.priority ?? '',
  isCritical: row.is_critical === 1,
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
  isActive: row.is_active === 1,
  linkedScriptId: row.linked_script_id ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const mapRowToDependency = (row: DependencyRow): ControlMJobDependency => ({
  id: row.id,
  predecessorJobId: row.predecessor_job_id,
  successorJobId: row.successor_job_id,
  conditionType: row.condition_type as 'OC' | 'NOTOK' | 'ANY',
  createdAt: row.created_at
});

const mapRowToCondition = (row: ConditionRow): ControlMJobCondition => ({
  id: row.id,
  jobId: row.job_id,
  conditionName: row.condition_name,
  conditionType: row.condition_type as 'IN' | 'OUT',
  odate: row.odate ?? undefined,
  createdAt: row.created_at
});

// ---- Count and List ----

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
  const db = await getDb();
  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (params.application) {
    conditions.push('application = ?');
    values.push(params.application);
  }
  if (params.nodeId) {
    conditions.push('node_id = ?');
    values.push(params.nodeId);
  }
  if (params.taskType) {
    conditions.push('task_type = ?');
    values.push(params.taskType);
  }
  if (params.isActive !== undefined) {
    conditions.push('is_active = ?');
    values.push(params.isActive ? 1 : 0);
  }
  if (params.searchQuery) {
    conditions.push('(job_name LIKE ? OR description LIKE ? OR mem_name LIKE ?)');
    const likePattern = `%${params.searchQuery}%`;
    values.push(likePattern, likePattern, likePattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = db.prepare(
    `SELECT COUNT(*) as count FROM controlm_jobs ${whereClause}`
  ).get(...values) as { count: number } | undefined;

  return result?.count ?? 0;
};

export const listJobs = async (params: ListJobsParams): Promise<ControlMJob[]> => {
  const db = await getDb();
  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (params.application) {
    conditions.push('application = ?');
    values.push(params.application);
  }
  if (params.nodeId) {
    conditions.push('node_id = ?');
    values.push(params.nodeId);
  }
  if (params.taskType) {
    conditions.push('task_type = ?');
    values.push(params.taskType);
  }
  if (params.isActive !== undefined) {
    conditions.push('is_active = ?');
    values.push(params.isActive ? 1 : 0);
  }
  if (params.searchQuery) {
    conditions.push('(job_name LIKE ? OR description LIKE ? OR mem_name LIKE ?)');
    const likePattern = `%${params.searchQuery}%`;
    values.push(likePattern, likePattern, likePattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (params.page - 1) * params.pageSize;
  values.push(params.pageSize, offset);

  const rows = db.prepare(
    `SELECT * FROM controlm_jobs ${whereClause} ORDER BY job_name ASC LIMIT ? OFFSET ?`
  ).all(...values);

  const jobs: ControlMJob[] = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (isJobRow(row)) {
        jobs.push(mapRowToJob(row));
      }
    }
  }
  return jobs;
};

// ---- Find by ID ----

export const findJobById = async (id: string): Promise<ControlMJob | null> => {
  const db = await getDb();
  const row = db.prepare('SELECT * FROM controlm_jobs WHERE id = ?').get(id);
  if (!isJobRow(row)) return null;
  return mapRowToJob(row);
};

export const findJobByJobIdAndApp = async (jobId: number, application: string): Promise<ControlMJob | null> => {
  const db = await getDb();
  const row = db.prepare('SELECT * FROM controlm_jobs WHERE job_id = ? AND application = ?').get(jobId, application);
  if (!isJobRow(row)) return null;
  return mapRowToJob(row);
};

export const findJobByJobName = async (jobName: string): Promise<ControlMJob | null> => {
  const db = await getDb();
  const row = db.prepare('SELECT * FROM controlm_jobs WHERE job_name = ?').get(jobName);
  if (!isJobRow(row)) return null;
  return mapRowToJob(row);
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
  const db = await getDb();

  // Simple INSERT - job_id is unique per CSV row
  db.prepare(
    `INSERT INTO controlm_jobs (
      id, job_id, application, group_name, mem_name, job_name, description,
      node_id, owner, task_type, is_cyclic, priority, is_critical,
      days_calendar, weeks_calendar, from_time, to_time, interval_value,
      mem_lib, author, creation_user, creation_date, change_user_id, change_date,
      is_active, linked_script_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
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
    input.isCyclic ? 1 : 0,
    input.priority ?? null,
    input.isCritical ? 1 : 0,
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
    input.isActive !== false ? 1 : 0,
    input.linkedScriptId ?? null,
    input.createdAt,
    input.updatedAt
  );

  const created = await findJobById(input.id);
  if (!created) {
    throw new Error('Failed to create job');
  }
  return created;
};

export const updateJob = async (id: string, updates: Partial<CreateJobInput>): Promise<ControlMJob | null> => {
  const db = await getDb();

  const setClauses: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.jobName !== undefined) {
    setClauses.push('job_name = ?');
    values.push(updates.jobName);
  }
  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    values.push(updates.description ?? null);
  }
  if (updates.isActive !== undefined) {
    setClauses.push('is_active = ?');
    values.push(updates.isActive ? 1 : 0);
  }
  if (updates.linkedScriptId !== undefined) {
    setClauses.push('linked_script_id = ?');
    values.push(updates.linkedScriptId ?? null);
  }

  if (setClauses.length === 0) {
    return findJobById(id);
  }

  values.push(id);
  db.prepare(
    `UPDATE controlm_jobs SET ${setClauses.join(', ')} WHERE id = ?`
  ).run(...values);

  return findJobById(id);
};

export const deleteJob = async (id: string): Promise<boolean> => {
  const db = await getDb();
  const result = db.prepare('DELETE FROM controlm_jobs WHERE id = ?').run(id);
  return result.changes > 0;
};

export const deleteAllJobs = async (): Promise<number> => {
  const db = await getDb();
  const result = db.prepare('DELETE FROM controlm_jobs').run();
  return result.changes;
};

// ---- Dependencies ----

export const createDependency = async (
  id: string,
  predecessorJobId: string,
  successorJobId: string,
  conditionType: string = 'OC',
  createdAt: string
): Promise<ControlMJobDependency> => {
  const db = await getDb();
  db.prepare(
    `INSERT OR IGNORE INTO controlm_job_dependencies (id, predecessor_job_id, successor_job_id, condition_type, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, predecessorJobId, successorJobId, conditionType, createdAt);
  return {
    id,
    predecessorJobId,
    successorJobId,
    conditionType: conditionType as 'OC' | 'NOTOK' | 'ANY',
    createdAt
  };
};

export const findPredecessors = async (jobId: string): Promise<ControlMJob[]> => {
  const db = await getDb();
  const rows = db.prepare(
    `SELECT j.* FROM controlm_jobs j
     INNER JOIN controlm_job_dependencies d ON d.predecessor_job_id = j.id
     WHERE d.successor_job_id = ?`
  ).all(jobId);

  const jobs: ControlMJob[] = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (isJobRow(row)) {
        jobs.push(mapRowToJob(row));
      }
    }
  }
  return jobs;
};

export const findSuccessors = async (jobId: string): Promise<ControlMJob[]> => {
  const db = await getDb();
  const rows = db.prepare(
    `SELECT j.* FROM controlm_jobs j
     INNER JOIN controlm_job_dependencies d ON d.successor_job_id = j.id
     WHERE d.predecessor_job_id = ?`
  ).all(jobId);

  const jobs: ControlMJob[] = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (isJobRow(row)) {
        jobs.push(mapRowToJob(row));
      }
    }
  }
  return jobs;
};

export const getAllDependencies = async (): Promise<ControlMJobDependency[]> => {
  const db = await getDb();
  const rows = db.prepare('SELECT * FROM controlm_job_dependencies').all();

  const deps: ControlMJobDependency[] = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (isDependencyRow(row)) {
        deps.push(mapRowToDependency(row));
      }
    }
  }
  return deps;
};

export const deleteAllDependencies = async (): Promise<number> => {
  const db = await getDb();
  const result = db.prepare('DELETE FROM controlm_job_dependencies').run();
  return result.changes;
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
  const db = await getDb();
  db.prepare(
    `INSERT INTO controlm_job_conditions (id, job_id, condition_name, condition_type, odate, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, jobId, conditionName, conditionType, odate, createdAt);
  return {
    id,
    jobId,
    conditionName,
    conditionType,
    odate: odate ?? undefined,
    createdAt
  };
};

export const findConditionsByJobId = async (jobId: string): Promise<ControlMJobCondition[]> => {
  const db = await getDb();
  const rows = db.prepare('SELECT * FROM controlm_job_conditions WHERE job_id = ?').all(jobId);

  const conditions: ControlMJobCondition[] = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (isConditionRow(row)) {
        conditions.push(mapRowToCondition(row));
      }
    }
  }
  return conditions;
};

export const deleteAllConditions = async (): Promise<number> => {
  const db = await getDb();
  const result = db.prepare('DELETE FROM controlm_job_conditions').run();
  return result.changes;
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
  const db = await getDb();

  const totalResult = db.prepare('SELECT COUNT(*) as count FROM controlm_jobs').get() as { count: number } | undefined;
  const activeResult = db.prepare('SELECT COUNT(*) as count FROM controlm_jobs WHERE is_active = 1').get() as { count: number } | undefined;
  const cyclicResult = db.prepare('SELECT COUNT(*) as count FROM controlm_jobs WHERE is_cyclic = 1').get() as { count: number } | undefined;

  const serverRows = db.prepare(
    'SELECT node_id, COUNT(*) as count FROM controlm_jobs GROUP BY node_id'
  ).all() as Array<{ node_id: string; count: number }>;
  const appRows = db.prepare(
    'SELECT application, COUNT(*) as count FROM controlm_jobs GROUP BY application'
  ).all() as Array<{ application: string; count: number }>;
  const typeRows = db.prepare(
    'SELECT task_type, COUNT(*) as count FROM controlm_jobs GROUP BY task_type'
  ).all() as Array<{ task_type: string; count: number }>;

  const jobsByServer: Record<string, number> = {};
  const jobsByApplication: Record<string, number> = {};
  const jobsByTaskType: Record<string, number> = {};

  if (Array.isArray(serverRows)) {
    for (const row of serverRows) {
      if (row && typeof row.node_id === 'string') {
        jobsByServer[row.node_id] = row.count;
      }
    }
  }
  if (Array.isArray(appRows)) {
    for (const row of appRows) {
      if (row && typeof row.application === 'string') {
        jobsByApplication[row.application] = row.count;
      }
    }
  }
  if (Array.isArray(typeRows)) {
    for (const row of typeRows) {
      if (row && typeof row.task_type === 'string') {
        jobsByTaskType[row.task_type] = row.count;
      }
    }
  }

  return {
    totalJobs: totalResult?.count ?? 0,
    activeJobs: activeResult?.count ?? 0,
    cyclicJobs: cyclicResult?.count ?? 0,
    jobsByServer,
    jobsByApplication,
    jobsByTaskType
  };
};

// ---- Distinct values for filters ----

export const getDistinctApplications = async (): Promise<string[]> => {
  const db = await getDb();
  const rows = db.prepare('SELECT DISTINCT application FROM controlm_jobs ORDER BY application').all();
  const result: string[] = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (row && typeof (row as { application?: string }).application === 'string') {
        result.push((row as { application: string }).application);
      }
    }
  }
  return result;
};

export const getDistinctNodes = async (): Promise<string[]> => {
  const db = await getDb();
  const rows = db.prepare('SELECT DISTINCT node_id FROM controlm_jobs ORDER BY node_id').all();
  const result: string[] = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (row && typeof (row as { node_id?: string }).node_id === 'string') {
        result.push((row as { node_id: string }).node_id);
      }
    }
  }
  return result;
};

// ---- Get all jobs for graph ----

export const getAllJobs = async (): Promise<ControlMJob[]> => {
  const db = await getDb();
  const rows = db.prepare('SELECT * FROM controlm_jobs ORDER BY job_name ASC').all();
  const jobs: ControlMJob[] = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (isJobRow(row)) {
        jobs.push(mapRowToJob(row));
      }
    }
  }
  return jobs;
};

// ---- Script Linking ----

/**
 * Link a Control-M job to a script by updating the linked_script_id field.
 *
 * @param jobId - The ID of the Control-M job
 * @param scriptId - The ID of the script to link (or null to unlink)
 * @returns The updated job or null if not found
 */
export const linkJobToScript = async (jobId: string, scriptId: string | null): Promise<ControlMJob | null> => {
  const db = await getDb();
  db.prepare('UPDATE controlm_jobs SET linked_script_id = ? WHERE id = ?').run(scriptId, jobId);
  return findJobById(jobId);
};

/**
 * Get all jobs that have a non-empty memName (script reference) but no linked script.
 *
 * @returns Array of jobs with memName but no linkedScriptId
 */
export const getJobsWithUnlinkedScripts = async (): Promise<ControlMJob[]> => {
  const db = await getDb();
  const rows = db.prepare(
    `SELECT * FROM controlm_jobs 
     WHERE mem_name IS NOT NULL 
       AND mem_name != '' 
       AND linked_script_id IS NULL
     ORDER BY job_name ASC`
  ).all();

  const jobs: ControlMJob[] = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (isJobRow(row)) {
        jobs.push(mapRowToJob(row));
      }
    }
  }
  return jobs;
};

/**
 * Get all jobs that have a linked script.
 *
 * @returns Array of jobs with linkedScriptId
 */
export const getJobsWithLinkedScripts = async (): Promise<ControlMJob[]> => {
  const db = await getDb();
  const rows = db.prepare(
    `SELECT * FROM controlm_jobs 
     WHERE linked_script_id IS NOT NULL
     ORDER BY job_name ASC`
  ).all();

  const jobs: ControlMJob[] = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (isJobRow(row)) {
        jobs.push(mapRowToJob(row));
      }
    }
  }
  return jobs;
};

/**
 * Bulk link jobs to scripts.
 *
 * @param links - Array of job ID to script ID mappings
 * @returns Number of jobs successfully linked
 */
export const bulkLinkJobsToScripts = async (links: Array<{ jobId: string; scriptId: string }>): Promise<number> => {
  const db = await getDb();
  let linkedCount = 0;

  const stmt = db.prepare('UPDATE controlm_jobs SET linked_script_id = ? WHERE id = ?');
  for (const { jobId, scriptId } of links) {
    const result = stmt.run(scriptId, jobId);
    if (result.changes > 0) {
      linkedCount++;
    }
  }

  return linkedCount;
};

/**
 * Get all jobs linked to a specific script.
 *
 * @param scriptId - The ID of the script
 * @returns Array of jobs linked to the script
 */
export const getJobsByScriptId = async (scriptId: string): Promise<ControlMJob[]> => {
  const db = await getDb();
  const rows = db.prepare(
    `SELECT * FROM controlm_jobs 
     WHERE linked_script_id = ?
     ORDER BY job_name ASC`
  ).all(scriptId);

  const jobs: ControlMJob[] = [];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (isJobRow(row)) {
        jobs.push(mapRowToJob(row));
      }
    }
  }
  return jobs;
};
