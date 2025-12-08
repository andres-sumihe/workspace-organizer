import { Router } from 'express';

import {
  listJobsHandler,
  getJobHandler,
  importJobsHandler,
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

const router = Router();

// GET /api/v1/controlm-jobs - List jobs with pagination and filters
router.get('/', listJobsHandler);

// GET /api/v1/controlm-jobs/stats - Get job statistics
router.get('/stats', getStatsHandler);

// GET /api/v1/controlm-jobs/filters - Get available filter values
router.get('/filters', getFiltersHandler);

// GET /api/v1/controlm-jobs/graph - Get dependency graph for visualization
router.get('/graph', getDependencyGraphHandler);

// GET /api/v1/controlm-jobs/linking-status - Get script linking status report
router.get('/linking-status', getLinkingStatusHandler);

// POST /api/v1/controlm-jobs/import - Import jobs from Control-M CSV
router.post('/import', importJobsHandler);

// POST /api/v1/controlm-jobs/auto-link - Auto-link all jobs to scripts based on memName
router.post('/auto-link', autoLinkHandler);

// DELETE /api/v1/controlm-jobs - Clear all jobs
router.delete('/', clearAllJobsHandler);

// GET /api/v1/controlm-jobs/:jobId - Get job detail
router.get('/:jobId', getJobHandler);

// GET /api/v1/controlm-jobs/:jobId/script-suggestions - Get script suggestions for a job
router.get('/:jobId/script-suggestions', getScriptSuggestionsHandler);

// DELETE /api/v1/controlm-jobs/:jobId - Delete a job
router.delete('/:jobId', deleteJobHandler);

// POST /api/v1/controlm-jobs/:jobId/link-script - Link job to a local script
router.post('/:jobId/link-script', linkToScriptHandler);

// DELETE /api/v1/controlm-jobs/:jobId/link-script - Unlink job from script
router.delete('/:jobId/link-script', unlinkFromScriptHandler);

export default router;
