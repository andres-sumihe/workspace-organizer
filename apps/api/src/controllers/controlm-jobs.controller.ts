import { parsePaginationQuery } from '../schemas/pagination.js';
import {
  getJobList,
  getJobDetailById,
  importFromCsv,
  getStats,
  getFilters,
  getDependencyGraph,
  deleteJobById,
  clearAllJobs,
  linkJobToScript,
  unlinkJobFromScript,
  autoLinkJobsToScripts,
  getScriptSuggestionsForJob,
  getLinkingStatus,
  createJobManually,
  updateJobDetails
} from '../services/controlm-jobs.service.js';

import type { RequestHandler } from 'express';
import type { ControlMTaskType } from '@workspace/shared';

export const listJobsHandler: RequestHandler = async (req, res) => {
  const pagination = parsePaginationQuery(req.query);

  const application = typeof req.query.application === 'string' ? req.query.application : undefined;
  const nodeId = typeof req.query.nodeId === 'string' ? req.query.nodeId : undefined;
  const taskType = typeof req.query.taskType === 'string' ? req.query.taskType : undefined;
  const isActive =
    req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
  const searchQuery = typeof req.query.searchQuery === 'string' ? req.query.searchQuery : undefined;

  const result = await getJobList({
    page: pagination.page,
    pageSize: pagination.pageSize,
    application,
    nodeId,
    taskType,
    isActive,
    searchQuery
  });

  res.json(result);
};

export const getJobHandler: RequestHandler = async (req, res) => {
  const jobId = req.params.jobId as string;
  if (!jobId) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'Job ID is required' });
  }

  const job = await getJobDetailById(jobId);
  if (!job) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Job not found' });
  }

  res.json({ job });
};

export const importJobsHandler: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;

  const csvContent = typeof body.csvContent === 'string' ? body.csvContent : undefined;
  const replaceExisting = typeof body.replaceExisting === 'boolean' ? body.replaceExisting : false;

  if (!csvContent) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'csvContent is required' });
  }

  const result = await importFromCsv(csvContent, replaceExisting);

  res.status(201).json(result);
};

export const createJobHandler: RequestHandler = async (req, res) => {
  const body = req.body as Record<string, unknown>;

  const jobName = typeof body.jobName === 'string' ? body.jobName : undefined;
  const application = typeof body.application === 'string' ? body.application : undefined;
  const groupName = typeof body.groupName === 'string' ? body.groupName : undefined;
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId : undefined;

  if (!jobName || !application || !groupName || !nodeId) {
    return res.status(400).json({
      code: 'INVALID_REQUEST',
      message: 'jobName, application, groupName, and nodeId are required'
    });
  }

  try {
    const job = await createJobManually({
      jobName,
      application,
      groupName,
      nodeId,
      description: typeof body.description === 'string' ? body.description : undefined,
      memName: typeof body.memName === 'string' ? body.memName : undefined,
      memLib: typeof body.memLib === 'string' ? body.memLib : undefined,
      owner: typeof body.owner === 'string' ? body.owner : undefined,
      taskType: typeof body.taskType === 'string' ? body.taskType as ControlMTaskType : undefined,
      isCyclic: typeof body.isCyclic === 'boolean' ? body.isCyclic : undefined,
      priority: typeof body.priority === 'string' ? body.priority : undefined,
      isCritical: typeof body.isCritical === 'boolean' ? body.isCritical : undefined,
      daysCalendar: typeof body.daysCalendar === 'string' ? body.daysCalendar : undefined,
      weeksCalendar: typeof body.weeksCalendar === 'string' ? body.weeksCalendar : undefined,
      fromTime: typeof body.fromTime === 'string' ? body.fromTime : undefined,
      toTime: typeof body.toTime === 'string' ? body.toTime : undefined,
      interval: typeof body.interval === 'string' ? body.interval : undefined,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      linkedScriptId: typeof body.linkedScriptId === 'string' ? body.linkedScriptId : undefined
    });

    res.status(201).json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create job';
    return res.status(400).json({ code: 'CREATE_FAILED', message });
  }
};

export const updateJobHandler: RequestHandler = async (req, res) => {
  const jobId = req.params.jobId as string;
  const body = req.body as Record<string, unknown>;

  if (!jobId) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'Job ID is required' });
  }

  try {
    const job = await updateJobDetails(jobId, {
      jobName: typeof body.jobName === 'string' ? body.jobName : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      memName: typeof body.memName === 'string' ? body.memName : undefined,
      memLib: typeof body.memLib === 'string' ? body.memLib : undefined,
      owner: typeof body.owner === 'string' ? body.owner : undefined,
      taskType: typeof body.taskType === 'string' ? body.taskType as ControlMTaskType : undefined,
      isCyclic: typeof body.isCyclic === 'boolean' ? body.isCyclic : undefined,
      priority: typeof body.priority === 'string' ? body.priority : undefined,
      isCritical: typeof body.isCritical === 'boolean' ? body.isCritical : undefined,
      daysCalendar: typeof body.daysCalendar === 'string' ? body.daysCalendar : undefined,
      weeksCalendar: typeof body.weeksCalendar === 'string' ? body.weeksCalendar : undefined,
      fromTime: typeof body.fromTime === 'string' ? body.fromTime : undefined,
      toTime: typeof body.toTime === 'string' ? body.toTime : undefined,
      interval: typeof body.interval === 'string' ? body.interval : undefined,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      linkedScriptId: body.linkedScriptId === null ? null : 
        (typeof body.linkedScriptId === 'string' ? body.linkedScriptId : undefined)
    });

    if (!job) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Job not found' });
    }

    res.json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update job';
    return res.status(400).json({ code: 'UPDATE_FAILED', message });
  }
};

export const getStatsHandler: RequestHandler = async (_req, res) => {
  const stats = await getStats();
  res.json({ stats });
};

export const getFiltersHandler: RequestHandler = async (_req, res) => {
  const filters = await getFilters();
  res.json(filters);
};

export const getDependencyGraphHandler: RequestHandler = async (req, res) => {
  const application = typeof req.query.application === 'string' ? req.query.application : undefined;
  const nodeId = typeof req.query.nodeId === 'string' ? req.query.nodeId : undefined;

  const graph = await getDependencyGraph(application, nodeId);
  res.json(graph);
};

export const deleteJobHandler: RequestHandler = async (req, res) => {
  const jobId = req.params.jobId as string;
  if (!jobId) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'Job ID is required' });
  }

  const deleted = await deleteJobById(jobId);
  if (!deleted) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Job not found' });
  }

  res.status(204).send();
};

export const clearAllJobsHandler: RequestHandler = async (_req, res) => {
  const count = await clearAllJobs();
  res.json({ deletedCount: count });
};

export const linkToScriptHandler: RequestHandler = async (req, res) => {
  const jobId = req.params.jobId as string;
  const body = req.body as Record<string, unknown>;
  const scriptId = typeof body.scriptId === 'string' ? body.scriptId : undefined;

  if (!jobId) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'Job ID is required' });
  }
  if (!scriptId) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'scriptId is required' });
  }

  try {
    const job = await linkJobToScript(jobId, scriptId);
    if (!job) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Job not found' });
    }
    res.json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to link script';
    return res.status(400).json({ code: 'LINK_FAILED', message });
  }
};

export const unlinkFromScriptHandler: RequestHandler = async (req, res) => {
  const jobId = req.params.jobId as string;

  if (!jobId) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'Job ID is required' });
  }

  const job = await unlinkJobFromScript(jobId);
  if (!job) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Job not found' });
  }

  res.json({ job });
};

export const autoLinkHandler: RequestHandler = async (_req, res) => {
  const result = await autoLinkJobsToScripts();
  res.json(result);
};

export const getScriptSuggestionsHandler: RequestHandler = async (req, res) => {
  const jobId = req.params.jobId as string;

  if (!jobId) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'Job ID is required' });
  }

  const suggestions = await getScriptSuggestionsForJob(jobId);
  res.json({ suggestions });
};

export const getLinkingStatusHandler: RequestHandler = async (_req, res) => {
  const status = await getLinkingStatus();
  res.json(status);
};
