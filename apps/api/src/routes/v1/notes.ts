import { Router } from 'express';

import { notesController } from '../../controllers/notes.controller.js';

export const notesRouter = Router();

// GET /api/v1/notes/search - Search notes by title/content (must be before /:id)
notesRouter.get('/search', notesController.search);

// GET /api/v1/notes - List notes with optional filters
notesRouter.get('/', notesController.list);

// GET /api/v1/notes/:id - Get a note by ID
notesRouter.get('/:id', notesController.getById);

// POST /api/v1/notes - Create a new note
notesRouter.post('/', notesController.create);

// PUT /api/v1/notes/:id - Update a note
notesRouter.put('/:id', notesController.update);

// DELETE /api/v1/notes/:id - Delete a note
notesRouter.delete('/:id', notesController.delete);
