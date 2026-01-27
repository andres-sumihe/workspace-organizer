import { overtimeService } from '../services/overtime.service.js';

import type { CreateOvertimeEntryRequest } from '@workspace/shared';
import type { NextFunction, Request, Response } from 'express';

export const overtimeController = {
  /**
   * GET /api/v1/tools/overtime/entries
   * List overtime entries with optional date range filter
   */
  async listEntries(req: Request, res: Response, next: NextFunction) {
    try {
      const { from, to } = req.query as { from?: string; to?: string };

      // Validate date formats if provided
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (from && !dateRegex.test(from)) {
        res.status(400).json({
          code: 'INVALID_DATE_FORMAT',
          message: 'from parameter must be in YYYY-MM-DD format'
        });
        return;
      }
      if (to && !dateRegex.test(to)) {
        res.status(400).json({
          code: 'INVALID_DATE_FORMAT',
          message: 'to parameter must be in YYYY-MM-DD format'
        });
        return;
      }

      const items = await overtimeService.listEntries({ from, to });
      res.json({ items });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/tools/overtime/entries
   * Create a new overtime entry with calculated pay
   */
  async createEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as CreateOvertimeEntryRequest;

      // Validate required fields
      if (!body.date) {
        res.status(400).json({
          code: 'MISSING_DATE',
          message: 'date is required'
        });
        return;
      }

      if (!body.dayType) {
        res.status(400).json({
          code: 'MISSING_DAY_TYPE',
          message: 'dayType is required'
        });
        return;
      }

      if (!body.startTime) {
        res.status(400).json({
          code: 'MISSING_START_TIME',
          message: 'startTime is required'
        });
        return;
      }

      if (!body.endTime) {
        res.status(400).json({
          code: 'MISSING_END_TIME',
          message: 'endTime is required'
        });
        return;
      }

      const entry = await overtimeService.createEntry(body);
      res.status(201).json({ entry });
    } catch (error) {
      // Handle specific errors
      if (error instanceof Error) {
        if (error.message.includes('Base salary is not configured')) {
          res.status(400).json({
            code: 'BASE_SALARY_NOT_CONFIGURED',
            message: error.message
          });
          return;
        }
        if (error.message.includes('greater than 0') || error.message.includes('format')) {
          res.status(400).json({
            code: 'VALIDATION_ERROR',
            message: error.message
          });
          return;
        }
      }
      next(error);
    }
  },

  /**
   * DELETE /api/v1/tools/overtime/entries/:id
   * Delete an overtime entry by ID
   */
  async deleteEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;

      if (!id) {
        res.status(400).json({
          code: 'MISSING_ID',
          message: 'Entry ID is required'
        });
        return;
      }

      const deleted = await overtimeService.deleteEntry(id);

      if (!deleted) {
        res.status(404).json({
          code: 'NOT_FOUND',
          message: `Overtime entry with ID ${id} not found`
        });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/tools/overtime/statistics
   * Get overtime statistics for a date range
   */
  async getStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const { from, to } = req.query as { from?: string; to?: string };

      // Validate date formats if provided
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (from && !dateRegex.test(from)) {
        res.status(400).json({
          code: 'INVALID_DATE_FORMAT',
          message: 'from parameter must be in YYYY-MM-DD format'
        });
        return;
      }
      if (to && !dateRegex.test(to)) {
        res.status(400).json({
          code: 'INVALID_DATE_FORMAT',
          message: 'to parameter must be in YYYY-MM-DD format'
        });
        return;
      }

      const statistics = await overtimeService.getStatistics({ from, to });
      res.json(statistics);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/tools/overtime/calculate
   * Calculate overtime pay without saving (preview)
   */
  async calculatePreview(req: Request, res: Response, next: NextFunction) {
    try {
      const { baseSalary, totalHours, dayType } = req.body as {
        baseSalary: number;
        totalHours: number;
        dayType: 'workday' | 'holiday_weekend';
      };

      // Validate inputs
      if (!baseSalary || baseSalary <= 0) {
        res.status(400).json({
          code: 'INVALID_BASE_SALARY',
          message: 'baseSalary must be a positive number'
        });
        return;
      }

      if (!totalHours || totalHours <= 0) {
        res.status(400).json({
          code: 'INVALID_TOTAL_HOURS',
          message: 'totalHours must be a positive number'
        });
        return;
      }

      if (dayType !== 'workday' && dayType !== 'holiday_weekend') {
        res.status(400).json({
          code: 'INVALID_DAY_TYPE',
          message: 'dayType must be "workday" or "holiday_weekend"'
        });
        return;
      }

      const payAmount = overtimeService.calculatePay(baseSalary, totalHours, dayType);
      const baseHourly = baseSalary / 173;

      res.json({
        baseSalary,
        totalHours,
        dayType,
        baseHourly: Math.round(baseHourly * 100) / 100,
        payAmount
      });
    } catch (error) {
      next(error);
    }
  }
};
