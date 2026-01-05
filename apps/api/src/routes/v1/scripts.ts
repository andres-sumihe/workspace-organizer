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
  getScriptActivityHandler
} from '../../controllers/scripts.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const scriptsRouter = Router();

// ALL routes require authentication - no exceptions
scriptsRouter.use(authMiddleware);

// Script CRUD operations
scriptsRouter.get('/', asyncHandler(listScriptsHandler));
scriptsRouter.post('/', asyncHandler(createScriptHandler));
scriptsRouter.get('/:scriptId', asyncHandler(getScriptDetailHandler));
scriptsRouter.patch('/:scriptId', asyncHandler(updateScriptHandler));
scriptsRouter.delete('/:scriptId', asyncHandler(deleteScriptHandler));

// Activity history for a script
scriptsRouter.get('/:scriptId/activity', asyncHandler(getScriptActivityHandler));

// Utility endpoints
scriptsRouter.post('/scan', asyncHandler(scanScriptsHandler));
scriptsRouter.get('/stats', asyncHandler(getStatsHandler));
scriptsRouter.get('/drives/analysis', asyncHandler(getDriveAnalysisHandler));
scriptsRouter.get('/drives/conflicts', asyncHandler(getConflictsHandler));
scriptsRouter.get('/tags', asyncHandler(listTagsHandler));
