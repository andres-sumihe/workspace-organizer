import { Router } from 'express';

import { overtimeController } from '../../controllers/overtime.controller.js';

const router = Router();

// GET /api/v1/tools/overtime/entries - List overtime entries
router.get('/entries', overtimeController.listEntries);

// POST /api/v1/tools/overtime/entries - Create a new overtime entry
router.post('/entries', overtimeController.createEntry);

// DELETE /api/v1/tools/overtime/entries/:id - Delete an overtime entry
router.delete('/entries/:id', overtimeController.deleteEntry);

// GET /api/v1/tools/overtime/statistics - Get overtime statistics
router.get('/statistics', overtimeController.getStatistics);

// POST /api/v1/tools/overtime/calculate - Calculate overtime preview (no save)
router.post('/calculate', overtimeController.calculatePreview);

export default router;
