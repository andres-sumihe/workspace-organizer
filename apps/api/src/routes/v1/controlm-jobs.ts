import { Router } from 'express';

import {
  listJobsHandler,
  getJobHandler,
  importJobsHandler,
  createJobHandler,
  updateJobHandler,
  getStatsHandler,
  getFiltersHandler,
  getDependencyGraphHandler,
  deleteJobHandler,
  clearAllJobsHandler,
  linkToScriptHandler,
  unlinkFromScriptHandler,
  autoLinkHandler,
  getScriptSuggestionsHandler,
  getLinkingStatusHandler
} from '../../controllers/controlm-jobs.controller.js';

export const controlmJobsRouter = Router();

// GET /api/v1/controlm-jobs - List jobs with pagination and filters
controlmJobsRouter.get('/', listJobsHandler);

// POST /api/v1/controlm-jobs - Create a new job manually
controlmJobsRouter.post('/', createJobHandler);

// GET /api/v1/controlm-jobs/stats - Get job statistics
controlmJobsRouter.get('/stats', getStatsHandler);

// GET /api/v1/controlm-jobs/filters - Get available filter values
controlmJobsRouter.get('/filters', getFiltersHandler);

// GET /api/v1/controlm-jobs/graph - Get dependency graph for visualization
controlmJobsRouter.get('/graph', getDependencyGraphHandler);

// GET /api/v1/controlm-jobs/linking-status - Get script linking status report
controlmJobsRouter.get('/linking-status', getLinkingStatusHandler);

// POST /api/v1/controlm-jobs/import - Import jobs from Control-M CSV
controlmJobsRouter.post('/import', importJobsHandler);

// POST /api/v1/controlm-jobs/auto-link - Auto-link all jobs to scripts based on memName
controlmJobsRouter.post('/auto-link', autoLinkHandler);

// DELETE /api/v1/controlm-jobs - Clear all jobs
controlmJobsRouter.delete('/', clearAllJobsHandler);

// GET /api/v1/controlm-jobs/:jobId - Get job detail
controlmJobsRouter.get('/:jobId', getJobHandler);

// PATCH /api/v1/controlm-jobs/:jobId - Update a job
controlmJobsRouter.patch('/:jobId', updateJobHandler);

// GET /api/v1/controlm-jobs/:jobId/script-suggestions - Get script suggestions for a job
controlmJobsRouter.get('/:jobId/script-suggestions', getScriptSuggestionsHandler);

// DELETE /api/v1/controlm-jobs/:jobId - Delete a job
controlmJobsRouter.delete('/:jobId', deleteJobHandler);

// POST /api/v1/controlm-jobs/:jobId/link-script - Link job to a local script
controlmJobsRouter.post('/:jobId/link-script', linkToScriptHandler);

// DELETE /api/v1/controlm-jobs/:jobId/link-script - Unlink job from script
controlmJobsRouter.delete('/:jobId/link-script', unlinkFromScriptHandler);
