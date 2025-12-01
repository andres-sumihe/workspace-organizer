import { Router } from 'express';

import * as templatesController from '../../controllers/templates.controller.js';

const router = Router();

// Template CRUD
router.get('/', templatesController.listTemplates);
router.post('/', templatesController.createTemplate);
router.get('/:templateId', templatesController.getTemplate);
router.patch('/:templateId', templatesController.updateTemplate);
router.delete('/:templateId', templatesController.deleteTemplate);

export default router;
