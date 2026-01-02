import { Router } from 'express';

import { settingsController } from '../../controllers/settings.controller.js';

const router = Router();

// GET /api/v1/settings - Get all settings
router.get('/', settingsController.getAllSettings);

// GET /api/v1/settings/validation - Get validation settings
router.get('/validation', settingsController.getValidationSettings);

// PUT /api/v1/settings/validation/iso20022 - Update ISO20022 settings
router.put('/validation/iso20022', settingsController.updateISO20022Settings);

// PUT /api/v1/settings/validation/swift-mt - Update SWIFT MT settings
router.put('/validation/swift-mt', settingsController.updateSwiftMTSettings);

// POST /api/v1/settings/validation/reset - Reset to defaults
router.post('/validation/reset', settingsController.resetValidationSettings);

// GET /api/v1/settings/tools/general - Get tools general settings (base salary)
router.get('/tools/general', settingsController.getToolsGeneralSettings);

// PUT /api/v1/settings/tools/general - Update tools general settings
router.put('/tools/general', settingsController.updateToolsGeneralSettings);

export default router;
