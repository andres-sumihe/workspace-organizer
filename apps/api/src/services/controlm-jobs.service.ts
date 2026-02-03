import { randomUUID } from 'node:crypto';

import {
  createJob,
  findJobById,
  listJobs,
  countJobs,
  updateJob,
  deleteJob,
  deleteAllJobs,
  deleteAllDependencies,
  deleteAllConditions,
  findPredecessors,
  findSuccessors,
  findConditionsByJobId,
  getJobStats,
  getDistinctApplications,
  getDistinctNodes,
  getAllJobs,
  getAllDependencies,
  getJobsWithUnlinkedScripts,
  getJobsWithLinkedScripts,
  bulkLinkJobsToScripts
} from '../repositories/controlm-jobs.repository.pg.js';
import { scriptsRepository, findScriptsByFilename } from '../repositories/scripts.repository.pg.js';

import type {
  ControlMJob,
  ControlMJobDetail,
  ControlMJobListResponse,
  ControlMJobStats,
  ControlMImportResult,
  ControlMTaskType,
  JobDependencyGraph,
  JobGraphNode,
  JobGraphEdge
} from '@workspace/shared';

// ---- CSV Parser ----

interface ParsedCsvRow {
  JOB_ID: string;
  APPLICATION: string;
  GROUP_NAME: string;
  MEMNAME: string;
  JOB_NAME: string;
  DESCRIPTION: string;
  AUTHOR: string;
  OWNER: string;
  PRIORITY: string;
  CRITICAL: string;
  TASK_TYPE: string;
  CYCLIC: string;
  NODE_ID: string;
  INTERVAL: string;
  MEM_LIB: string;
  DAYS_CAL: string;
  WEEKS_CAL: string;
  FROM_TIME: string;
  TO_TIME: string;
  CREATION_USER: string;
  CREATION_DATE: string;
  CHANGE_USERID: string;
  CHANGE_DATE: string;
}

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
};

const parseControlMCsv = (csvContent: string): ParsedCsvRow[] => {
  const lines = csvContent.split('\n');
  if (lines.length < 2) return [];

  // Parse header line
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(h => h.trim().toUpperCase());

  const headerIndexMap: Record<string, number> = {};
  headers.forEach((header, index) => {
    headerIndexMap[header] = index;
  });

  const rows: ParsedCsvRow[] = [];
  let currentRow = '';

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    currentRow += (currentRow ? '\n' : '') + line;

    // Check if we have a complete row (count quotes to handle multiline descriptions)
    const quoteCount = (currentRow.match(/"/g) || []).length;
    if (quoteCount % 2 === 0) {
      const values = parseCSVLine(currentRow);

      const getValue = (key: string): string => {
        const index = headerIndexMap[key];
        return index !== undefined ? (values[index] ?? '').trim() : '';
      };

      const row: ParsedCsvRow = {
        JOB_ID: getValue('JOB_ID'),
        APPLICATION: getValue('APPLICATION'),
        GROUP_NAME: getValue('GROUP_NAME'),
        MEMNAME: getValue('MEMNAME'),
        JOB_NAME: getValue('JOB_NAME'),
        DESCRIPTION: getValue('DESCRIPTION'),
        AUTHOR: getValue('AUTHOR'),
        OWNER: getValue('OWNER'),
        PRIORITY: getValue('PRIORITY'),
        CRITICAL: getValue('CRITICAL'),
        TASK_TYPE: getValue('TASK_TYPE'),
        CYCLIC: getValue('CYCLIC'),
        NODE_ID: getValue('NODE_ID'),
        INTERVAL: getValue('INTERVAL'),
        MEM_LIB: getValue('MEM_LIB'),
        DAYS_CAL: getValue('DAYS_CAL'),
        WEEKS_CAL: getValue('WEEKS_CAL'),
        FROM_TIME: getValue('FROM_TIME'),
        TO_TIME: getValue('TO_TIME'),
        CREATION_USER: getValue('CREATION_USER'),
        CREATION_DATE: getValue('CREATION_DATE'),
        CHANGE_USERID: getValue('CHANGE_USERID'),
        CHANGE_DATE: getValue('CHANGE_DATE')
      };

      // Only add if we have valid job data
      if (row.JOB_NAME && row.NODE_ID) {
        rows.push(row);
      }

      currentRow = '';
    }
  }

  return rows;
};

const mapTaskType = (taskType: string): ControlMTaskType => {
  const type = taskType.trim().toLowerCase();
  if (type === 'job') return 'Job';
  if (type === 'dummy') return 'Dummy';
  if (type === 'command') return 'Command';
  if (type === 'filewatcher') return 'FileWatcher';
  return 'Job';
};

// ---- Service Functions ----

export interface JobListOptions {
  page: number;
  pageSize: number;
  application?: string;
  nodeId?: string;
  taskType?: string;
  isActive?: boolean;
  searchQuery?: string;
}

export const getJobList = async (options: JobListOptions): Promise<ControlMJobListResponse> => {
  const [items, total] = await Promise.all([
    listJobs({
      page: options.page,
      pageSize: options.pageSize,
      application: options.application,
      nodeId: options.nodeId,
      taskType: options.taskType,
      isActive: options.isActive,
      searchQuery: options.searchQuery
    }),
    countJobs({
      application: options.application,
      nodeId: options.nodeId,
      taskType: options.taskType,
      isActive: options.isActive,
      searchQuery: options.searchQuery
    })
  ]);

  return {
    items,
    meta: {
      page: options.page,
      pageSize: options.pageSize,
      total,
      hasNextPage: options.page * options.pageSize < total,
      hasPreviousPage: options.page > 1
    }
  };
};

export const getJobDetailById = async (id: string): Promise<ControlMJobDetail | null> => {
  const job = await findJobById(id);
  if (!job) return null;

  const [predecessors, successors, conditions] = await Promise.all([
    findPredecessors(id),
    findSuccessors(id),
    findConditionsByJobId(id)
  ]);

  // Fetch linked script if linkedScriptId exists
  let linkedScript = undefined;
  if (job.linkedScriptId) {
    const script = await scriptsRepository.getById(job.linkedScriptId);
    if (script) {
      linkedScript = script;
    }
  }

  return {
    ...job,
    predecessors,
    successors,
    conditions,
    linkedScript
  };
};

export const importFromCsv = async (
  csvContent: string,
  replaceExisting: boolean = false
): Promise<ControlMImportResult> => {
  const result: ControlMImportResult = {
    importedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    errors: []
  };

  try {
    // Parse CSV
    const parsedRows = parseControlMCsv(csvContent);

    if (parsedRows.length === 0) {
      result.errors.push('No valid job data found in CSV');
      return result;
    }

    // Optionally clear existing data
    if (replaceExisting) {
      await deleteAllConditions();
      await deleteAllDependencies();
      await deleteAllJobs();
    }

    const now = new Date().toISOString();
    const jobIdMap = new Map<string, string>(); // JOB_NAME -> internal ID

    // Import all jobs - each row has a unique JOB_ID
    for (const row of parsedRows) {
      try {
        const jobIdNum = parseInt(row.JOB_ID, 10);
        if (isNaN(jobIdNum)) {
          result.errors.push(`Invalid JOB_ID for ${row.JOB_NAME}: ${row.JOB_ID}`);
          result.skippedCount++;
          continue;
        }

        const id = randomUUID();

        // Clean up description (remove multiline artifacts)
        const cleanDescription = row.DESCRIPTION
          .replace(/\r?\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const job = await createJob({
          id,
          jobId: jobIdNum,
          application: row.APPLICATION,
          groupName: row.GROUP_NAME,
          memName: row.MEMNAME || undefined,
          jobName: row.JOB_NAME,
          description: cleanDescription || undefined,
          nodeId: row.NODE_ID,
          owner: row.OWNER || undefined,
          taskType: mapTaskType(row.TASK_TYPE),
          isCyclic: row.CYCLIC === '1',
          priority: row.PRIORITY || undefined,
          isCritical: row.CRITICAL === '1',
          daysCalendar: row.DAYS_CAL || undefined,
          weeksCalendar: row.WEEKS_CAL || undefined,
          fromTime: row.FROM_TIME || undefined,
          toTime: row.TO_TIME || undefined,
          interval: row.INTERVAL || undefined,
          memLib: row.MEM_LIB || undefined,
          author: row.AUTHOR || undefined,
          creationUser: row.CREATION_USER || undefined,
          creationDate: row.CREATION_DATE || undefined,
          changeUserId: row.CHANGE_USERID || undefined,
          changeDate: row.CHANGE_DATE || undefined,
          isActive: true,
          createdAt: now,
          updatedAt: now
        });

        jobIdMap.set(row.JOB_NAME, job.id);
        result.importedCount++;
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err);
        result.errors.push(`Failed to import ${row.JOB_NAME}: ${errMessage}`);
        result.skippedCount++;
      }
    }

    // Note: Dependencies should come from actual CSV data (IN_COND/OUT_COND columns)
    // not from inferred patterns. Currently no dependency import is implemented.

  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    result.errors.push(`CSV parsing error: ${errMessage}`);
  }

  return result;
};

export const getStats = async (): Promise<ControlMJobStats> => {
  return await getJobStats();
};

export const getFilters = async (): Promise<{
  applications: string[];
  nodes: string[];
}> => {
  const [applications, nodes] = await Promise.all([
    getDistinctApplications(),
    getDistinctNodes()
  ]);

  return { applications, nodes };
};

export const getDependencyGraph = async (
  application?: string,
  nodeId?: string
): Promise<JobDependencyGraph> => {
  // Get all jobs (optionally filtered)
  let jobs = await getAllJobs();

  if (application) {
    jobs = jobs.filter(j => j.application === application);
  }
  if (nodeId) {
    jobs = jobs.filter(j => j.nodeId === nodeId);
  }

  const jobIdSet = new Set(jobs.map(j => j.id));

  // Get all dependencies
  const allDeps = await getAllDependencies();

  // Filter dependencies to only include jobs in our set
  const filteredDeps = allDeps.filter(
    d => jobIdSet.has(d.predecessorJobId) && jobIdSet.has(d.successorJobId)
  );

  // Build nodes
  const nodes: JobGraphNode[] = jobs.map(job => ({
    id: job.id,
    jobName: job.jobName,
    nodeId: job.nodeId,
    taskType: job.taskType,
    isActive: job.isActive,
    isCyclic: job.isCyclic
  }));

  // Build edges
  const edges: JobGraphEdge[] = filteredDeps.map(dep => ({
    id: dep.id,
    source: dep.predecessorJobId,
    target: dep.successorJobId,
    conditionType: dep.conditionType
  }));

  return { nodes, edges };
};

export const deleteJobById = async (id: string): Promise<boolean> => {
  return await deleteJob(id);
};

export const clearAllJobs = async (): Promise<number> => {
  await deleteAllConditions();
  await deleteAllDependencies();
  return await deleteAllJobs();
};

export const linkJobToScript = async (jobId: string, scriptId: string): Promise<ControlMJob | null> => {
  // Verify script exists
  const script = await scriptsRepository.getById(scriptId);
  if (!script) {
    throw new Error('Script not found');
  }

  return await updateJob(jobId, { linkedScriptId: scriptId });
};

export const unlinkJobFromScript = async (jobId: string): Promise<ControlMJob | null> => {
  return await updateJob(jobId, { linkedScriptId: undefined });
};

export interface AutoLinkResult {
  totalJobsWithScripts: number;
  alreadyLinked: number;
  newlyLinked: number;
  noMatchFound: number;
  links: Array<{
    jobId: string;
    jobName: string;
    memName: string;
    scriptId: string;
    scriptName: string;
  }>;
  unmatched: Array<{
    jobId: string;
    jobName: string;
    memName: string;
  }>;
}

/**
 * Automatically link Control-M jobs to scripts based on memName matching.
 * Matches job's memName (script filename) against script's name or filePath.
 *
 * @returns AutoLinkResult with details about linking operation
 */
export const autoLinkJobsToScripts = async (): Promise<AutoLinkResult> => {
  // Get all jobs that have a memName but no linked script
  const unlinkedJobs = await getJobsWithUnlinkedScripts();
  const linkedJobs = await getJobsWithLinkedScripts();

  const result: AutoLinkResult = {
    totalJobsWithScripts: unlinkedJobs.length + linkedJobs.length,
    alreadyLinked: linkedJobs.length,
    newlyLinked: 0,
    noMatchFound: 0,
    links: [],
    unmatched: []
  };

  const linksToCreate: Array<{ jobId: string; scriptId: string }> = [];

  for (const job of unlinkedJobs) {
    if (!job.memName) continue;

    // Try to find a matching script
    const matchingScripts = await findScriptsByFilename(job.memName);

    if (matchingScripts.length > 0) {
      // Use the first match (most specific match from the query)
      const script = matchingScripts[0];
      linksToCreate.push({ jobId: job.id, scriptId: script.id });
      result.links.push({
        jobId: job.id,
        jobName: job.jobName,
        memName: job.memName,
        scriptId: script.id,
        scriptName: script.name
      });
    } else {
      result.unmatched.push({
        jobId: job.id,
        jobName: job.jobName,
        memName: job.memName
      });
      result.noMatchFound++;
    }
  }

  // Bulk update all the links
  if (linksToCreate.length > 0) {
    result.newlyLinked = await bulkLinkJobsToScripts(linksToCreate);
  }

  return result;
};

/**
 * Get suggestions for linking a specific job to scripts.
 * Returns potential script matches based on the job's memName.
 *
 * @param jobId - The ID of the job to get suggestions for
 * @returns Array of potential script matches
 */
export const getScriptSuggestionsForJob = async (
  jobId: string
): Promise<Array<{ script: { id: string; name: string }; matchType: string; confidence: number }>> => {
  const job = await findJobById(jobId);
  if (!job || !job.memName) {
    return [];
  }

  const suggestions: Array<{
    script: { id: string; name: string };
    matchType: string;
    confidence: number;
  }> = [];

  // Find scripts by filename pattern
  const matchingScripts = await findScriptsByFilename(job.memName);

  for (const script of matchingScripts) {
    let matchType = 'partial';
    let confidence = 0.5;

    const memNameUpper = job.memName.toUpperCase();
    const memNameWithoutExt = memNameUpper.replace(/\\.[^.]+$/, '');
    const scriptNameUpper = script.name.toUpperCase();

    // Calculate confidence based on match type (name-based matching)
    if (scriptNameUpper === memNameUpper) {
      matchType = 'exact_name';
      confidence = 1.0;
    } else if (scriptNameUpper === memNameWithoutExt) {
      matchType = 'name_without_extension';
      confidence = 0.9;
    } else if (scriptNameUpper.includes(memNameWithoutExt)) {
      matchType = 'name_contains';
      confidence = 0.7;
    }

    suggestions.push({
      script: { id: script.id, name: script.name },
      matchType,
      confidence
    });
  }

  // Sort by confidence descending
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return suggestions;
};

export interface LinkingStatusReport {
  totalJobs: number;
  jobsWithMemName: number;
  linkedJobs: number;
  unlinkedJobs: number;
  linkingPercentage: number;
}

/**
 * Get a summary report of job-to-script linking status.
 *
 * @returns LinkingStatusReport with linking statistics
 */
export const getLinkingStatus = async (): Promise<LinkingStatusReport> => {
  const allJobs = await getAllJobs();
  const linkedJobs = await getJobsWithLinkedScripts();
  const unlinkedJobs = await getJobsWithUnlinkedScripts();

  const jobsWithMemName = allJobs.filter(j => j.memName && j.memName.trim() !== '').length;

  return {
    totalJobs: allJobs.length,
    jobsWithMemName,
    linkedJobs: linkedJobs.length,
    unlinkedJobs: unlinkedJobs.length,
    linkingPercentage: jobsWithMemName > 0 ? Math.round((linkedJobs.length / jobsWithMemName) * 100) : 0
  };
};
