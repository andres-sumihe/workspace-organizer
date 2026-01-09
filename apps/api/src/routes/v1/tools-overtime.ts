import { Router } from 'express';

import { overtimeController } from '../../controllers/overtime.controller.js';

export const toolsOvertimeRouter = Router();

// GET /api/v1/tools/overtime/entries - List overtime entries
toolsOvertimeRouter.get('/entries', overtimeController.listEntries);

// POST /api/v1/tools/overtime/entries - Create a new overtime entry
toolsOvertimeRouter.post('/entries', overtimeController.createEntry);

// DELETE /api/v1/tools/overtime/entries/:id - Delete an overtime entry
toolsOvertimeRouter.delete('/entries/:id', overtimeController.deleteEntry);

// GET /api/v1/tools/overtime/statistics - Get overtime statistics
toolsOvertimeRouter.get('/statistics', overtimeController.getStatistics);

// POST /api/v1/tools/overtime/calculate - Calculate overtime preview (no save)
toolsOvertimeRouter.post('/calculate', overtimeController.calculatePreview);
