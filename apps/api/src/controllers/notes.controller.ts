import { notesService } from '../services/notes.service.js';

import type { CreateNoteRequest, UpdateNoteRequest } from '@workspace/shared';
import type { NextFunction, Request, Response } from 'express';

export const notesController = {
  /**
   * GET /api/v1/notes
   * List notes with optional filters
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId, search } = req.query as { projectId?: string; search?: string };

      const items = await notesService.list({
        projectId,
        search
      });

      res.json({ items });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/notes/:id
   * Get a note by ID
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;

      const note = await notesService.getById(id);

      if (!note) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: `Note with ID ${id} not found`
        });
        return;
      }

      res.json({ note });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/notes
   * Create a new note
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateNoteRequest;

      // Validate required fields
      if (!body.title || body.title.trim().length === 0) {
        res.status(400).json({
          code: 'MISSING_TITLE',
          message: 'title is required'
        });
        return;
      }

      const note = await notesService.create(body);
      res.status(201).json({ note });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/notes/:id
   * Update a note
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const body = req.body as UpdateNoteRequest;

      const note = await notesService.update(id, body);
      res.json({ note });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: error.message
        });
        return;
      }
      next(error);
    }
  },

  /**
   * DELETE /api/v1/notes/:id
   * Delete a note
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;

      const deleted = await notesService.delete(id);

      if (!deleted) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: `Note with ID ${id} not found`
        });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/notes/search?q=<query>
   * Search notes by title or content
   */
  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const { q, limit } = req.query as { q?: string; limit?: string };

      if (!q || q.trim().length === 0) {
        res.json({ items: [] });
        return;
      }

      const maxLimit = limit ? parseInt(limit, 10) : 20;
      const items = await notesService.search(q.trim(), maxLimit);
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
};
