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
  listTagsHandler
} from '../../controllers/scripts.controller.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const scriptsRouter = Router();

// Script CRUD operations
scriptsRouter.get('/', asyncHandler(listScriptsHandler));
scriptsRouter.post('/', asyncHandler(createScriptHandler));
scriptsRouter.get('/:scriptId', asyncHandler(getScriptDetailHandler));
scriptsRouter.patch('/:scriptId', asyncHandler(updateScriptHandler));
scriptsRouter.delete('/:scriptId', asyncHandler(deleteScriptHandler));

// Utility endpoints
scriptsRouter.post('/scan', asyncHandler(scanScriptsHandler));
scriptsRouter.get('/stats', asyncHandler(getStatsHandler));
scriptsRouter.get('/drives/analysis', asyncHandler(getDriveAnalysisHandler));
scriptsRouter.get('/drives/conflicts', asyncHandler(getConflictsHandler));
scriptsRouter.get('/tags', asyncHandler(listTagsHandler));
