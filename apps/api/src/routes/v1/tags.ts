import { Router } from 'express';

import { tagsController } from '../../controllers/tags.controller.js';

export const tagsRouter = Router();

// GET /api/v1/tags/search - Search tags by name (must be before /:id)
tagsRouter.get('/search', tagsController.search);

// GET /api/v1/tags - List all tags
tagsRouter.get('/', tagsController.list);

// GET /api/v1/tags/:id - Get a tag by ID
tagsRouter.get('/:id', tagsController.getById);

// POST /api/v1/tags - Create a new tag
tagsRouter.post('/', tagsController.create);

// PUT /api/v1/tags/:id - Update a tag
tagsRouter.put('/:id', tagsController.update);

// DELETE /api/v1/tags/:id - Delete a tag
tagsRouter.delete('/:id', tagsController.delete);
