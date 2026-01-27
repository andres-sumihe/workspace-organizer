import { tagsService } from '../services/tags.service.js';

import type { CreateTagRequest, UpdateTagRequest } from '@workspace/shared';
import type { NextFunction, Request, Response } from 'express';

export const tagsController = {
  /**
   * GET /api/v1/tags
   * List all tags
   */
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const items = await tagsService.list();
      res.json({ items });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/tags/:id
   * Get a tag by ID
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;

      const tag = await tagsService.getById(id);

      if (!tag) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: `Tag with ID ${id} not found`
        });
        return;
      }

      res.json({ tag });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/tags
   * Create a new tag
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateTagRequest;

      // Validate required fields
      if (!body.name || body.name.trim().length === 0) {
        res.status(400).json({
          code: 'MISSING_NAME',
          message: 'name is required'
        });
        return;
      }

      const tag = await tagsService.create(body);
      res.status(201).json({ tag });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({
          code: 'TAG_EXISTS',
          message: error.message
        });
        return;
      }
      next(error);
    }
  },

  /**
   * PUT /api/v1/tags/:id
   * Update a tag
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const body = req.body as UpdateTagRequest;

      const tag = await tagsService.update(id, body);
      res.json({ tag });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            code: 'NOT_FOUND',
            message: error.message
          });
          return;
        }
        if (error.message.includes('already exists')) {
          res.status(409).json({
            code: 'TAG_EXISTS',
            message: error.message
          });
          return;
        }
      }
      next(error);
    }
  },

  /**
   * DELETE /api/v1/tags/:id
   * Delete a tag
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;

      const deleted = await tagsService.delete(id);

      if (!deleted) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: `Tag with ID ${id} not found`
        });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/tags/search?q=<query>
   * Search tags by name prefix (for autocomplete)
   */
  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const { q, limit } = req.query as { q?: string; limit?: string };

      if (!q || q.trim().length === 0) {
        res.json({ items: [] });
        return;
      }

      const maxLimit = limit ? parseInt(limit, 10) : 10;
      const items = await tagsService.search(q.trim(), maxLimit);
      res.json({ items });
    } catch (error) {
      next(error);
    }
  }
};
