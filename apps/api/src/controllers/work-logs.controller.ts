import { workLogsService } from '../services/work-logs.service.js';

import type {
  CreateWorkLogRequest,
  UpdateWorkLogRequest,
  RolloverWorkLogsRequest,
  WorkLogStatus
} from '@workspace/shared';
import type { NextFunction, Request, Response } from 'express';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES: WorkLogStatus[] = ['todo', 'in_progress', 'done', 'blocked'];

export const workLogsController = {
  /**
   * GET /api/v1/work-logs
   * List work logs with optional filters
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { from, to, projectId, tagIds, status } = req.query as {
        from?: string;
        to?: string;
        projectId?: string;
        tagIds?: string;
        status?: string;
      };

      // Validate date formats
      if (from && !DATE_REGEX.test(from)) {
        res.status(400).json({
          code: 'INVALID_DATE_FORMAT',
          message: 'from parameter must be in YYYY-MM-DD format'
        });
        return;
      }
      if (to && !DATE_REGEX.test(to)) {
        res.status(400).json({
          code: 'INVALID_DATE_FORMAT',
          message: 'to parameter must be in YYYY-MM-DD format'
        });
        return;
      }

      // Parse tagIds as comma-separated list
      const tagIdArray = tagIds ? tagIds.split(',').map((id) => id.trim()) : undefined;

      // Parse status as comma-separated list
      let statusArray: WorkLogStatus[] | undefined;
      if (status) {
        const parsed = status.split(',').map((s) => s.trim()) as WorkLogStatus[];
        const invalid = parsed.filter((s) => !VALID_STATUSES.includes(s));
        if (invalid.length > 0) {
          res.status(400).json({
            code: 'INVALID_STATUS',
            message: `Invalid status values: ${invalid.join(', ')}. Valid values: ${VALID_STATUSES.join(', ')}`
          });
          return;
        }
        statusArray = parsed;
      }

      const items = await workLogsService.list({
        from,
        to,
        projectId,
        tagIds: tagIdArray,
        status: statusArray
      });

      res.json({ items });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/work-logs/:id
   * Get a work log by ID
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const entry = await workLogsService.getById(id);

      if (!entry) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: `Work log with ID ${id} not found`
        });
        return;
      }

      res.json({ entry });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/work-logs
   * Create a new work log
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateWorkLogRequest;

      // Validate required fields
      if (!body.date) {
        res.status(400).json({
          code: 'MISSING_DATE',
          message: 'date is required'
        });
        return;
      }

      if (!DATE_REGEX.test(body.date)) {
        res.status(400).json({
          code: 'INVALID_DATE_FORMAT',
          message: 'date must be in YYYY-MM-DD format'
        });
        return;
      }

      if (!body.content || body.content.trim().length === 0) {
        res.status(400).json({
          code: 'MISSING_CONTENT',
          message: 'content is required'
        });
        return;
      }

      if (body.status && !VALID_STATUSES.includes(body.status)) {
        res.status(400).json({
          code: 'INVALID_STATUS',
          message: `Invalid status. Valid values: ${VALID_STATUSES.join(', ')}`
        });
        return;
      }

      const entry = await workLogsService.create(body);
      res.status(201).json({ entry });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/work-logs/:id
   * Update a work log
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const body = req.body as UpdateWorkLogRequest;

      // Validate date format if provided
      if (body.date && !DATE_REGEX.test(body.date)) {
        res.status(400).json({
          code: 'INVALID_DATE_FORMAT',
          message: 'date must be in YYYY-MM-DD format'
        });
        return;
      }

      if (body.status && !VALID_STATUSES.includes(body.status)) {
        res.status(400).json({
          code: 'INVALID_STATUS',
          message: `Invalid status. Valid values: ${VALID_STATUSES.join(', ')}`
        });
        return;
      }

      const entry = await workLogsService.update(id, body);
      res.json({ entry });
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
   * DELETE /api/v1/work-logs/:id
   * Delete a work log
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const deleted = await workLogsService.delete(id);

      if (!deleted) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: `Work log with ID ${id} not found`
        });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/work-logs/rollover
   * Rollover unfinished work logs to a new date
   */
  async rollover(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as RolloverWorkLogsRequest;

      // Validate required fields
      if (!body.fromDate) {
        res.status(400).json({
          code: 'MISSING_FROM_DATE',
          message: 'fromDate is required'
        });
        return;
      }

      if (!DATE_REGEX.test(body.fromDate)) {
        res.status(400).json({
          code: 'INVALID_DATE_FORMAT',
          message: 'fromDate must be in YYYY-MM-DD format'
        });
        return;
      }

      if (body.toDate && !DATE_REGEX.test(body.toDate)) {
        res.status(400).json({
          code: 'INVALID_DATE_FORMAT',
          message: 'toDate must be in YYYY-MM-DD format'
        });
        return;
      }

      if (!body.mode || !['move', 'copy'].includes(body.mode)) {
        res.status(400).json({
          code: 'INVALID_MODE',
          message: 'mode must be either "move" or "copy"'
        });
        return;
      }

      const result = await workLogsService.rollover(body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
};
