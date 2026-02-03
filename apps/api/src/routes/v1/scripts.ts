import { Router } from 'express';

import {
  listScriptsHandler,
  getScriptDetailHandler,
  createScriptHandler,
  updateScriptHandler,
  deleteScriptHandler,
  scanScriptsHandler,
  getStatsHandler,
  getDriveAnalysisHandler,
  getConflictsHandler,
  listTagsHandler,
  createTagHandler,
  getScriptActivityHandler
} from '../../controllers/scripts.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const scriptsRouter = Router();

// ALL routes require authentication - no exceptions
scriptsRouter.use(authMiddleware);

// Static routes MUST be before parameterized routes
scriptsRouter.get('/stats', asyncHandler(getStatsHandler));
scriptsRouter.get('/tags', asyncHandler(listTagsHandler));
scriptsRouter.post('/tags', asyncHandler(createTagHandler));
scriptsRouter.get('/drives/analysis', asyncHandler(getDriveAnalysisHandler));
scriptsRouter.get('/drives/conflicts', asyncHandler(getConflictsHandler));
scriptsRouter.post('/scan', asyncHandler(scanScriptsHandler));

// Script CRUD operations
scriptsRouter.get('/', asyncHandler(listScriptsHandler));
scriptsRouter.post('/', asyncHandler(createScriptHandler));

// Parameterized routes AFTER static routes
scriptsRouter.get('/:scriptId', asyncHandler(getScriptDetailHandler));
scriptsRouter.patch('/:scriptId', asyncHandler(updateScriptHandler));
scriptsRouter.delete('/:scriptId', asyncHandler(deleteScriptHandler));
scriptsRouter.get('/:scriptId/activity', asyncHandler(getScriptActivityHandler));
