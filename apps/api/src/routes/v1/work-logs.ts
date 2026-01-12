import { Router } from 'express';

import { workLogsController } from '../../controllers/work-logs.controller.js';

export const workLogsRouter = Router();

// GET /api/v1/work-logs - List work logs
workLogsRouter.get('/', workLogsController.list);

// POST /api/v1/work-logs/rollover - Rollover unfinished work logs
workLogsRouter.post('/rollover', workLogsController.rollover);

// GET /api/v1/work-logs/:id - Get a work log by ID
workLogsRouter.get('/:id', workLogsController.getById);

// POST /api/v1/work-logs - Create a new work log
workLogsRouter.post('/', workLogsController.create);

// PUT /api/v1/work-logs/:id - Update a work log
workLogsRouter.put('/:id', workLogsController.update);

// DELETE /api/v1/work-logs/:id - Delete a work log
workLogsRouter.delete('/:id', workLogsController.delete);
