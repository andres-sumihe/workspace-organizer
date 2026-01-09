import { Router } from 'express';

import { settingsController } from '../../controllers/settings.controller.js';

export const settingsRouter = Router();

// GET /api/v1/settings - Get all settings
settingsRouter.get('/', settingsController.getAllSettings);

// GET /api/v1/settings/validation - Get validation settings
settingsRouter.get('/validation', settingsController.getValidationSettings);

// PUT /api/v1/settings/validation/iso20022 - Update ISO20022 settings
settingsRouter.put('/validation/iso20022', settingsController.updateISO20022Settings);

// PUT /api/v1/settings/validation/swift-mt - Update SWIFT MT settings
settingsRouter.put('/validation/swift-mt', settingsController.updateSwiftMTSettings);

// POST /api/v1/settings/validation/reset - Reset to defaults
settingsRouter.post('/validation/reset', settingsController.resetValidationSettings);

// GET /api/v1/settings/tools/general - Get tools general settings (base salary)
settingsRouter.get('/tools/general', settingsController.getToolsGeneralSettings);

// PUT /api/v1/settings/tools/general - Update tools general settings
settingsRouter.put('/tools/general', settingsController.updateToolsGeneralSettings);
