import { Router } from 'express';

import * as templatesController from '../../controllers/templates.controller.js';

export const templatesRouter = Router();

// Template CRUD
templatesRouter.get('/', templatesController.listTemplates);
templatesRouter.post('/', templatesController.createTemplate);
templatesRouter.get('/:templateId', templatesController.getTemplate);
templatesRouter.patch('/:templateId', templatesController.updateTemplate);
templatesRouter.delete('/:templateId', templatesController.deleteTemplate);
