import { settingsService } from '../services/settings.service.js';

import type { ToolsGeneralSettings } from '@workspace/shared';
import type { NextFunction, Request, Response } from 'express';

export const settingsController = {
  /**
   * GET /api/v1/settings/validation
   * Get all validation settings
   */
  async getValidationSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await settingsService.getValidationSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/settings/validation/iso20022
   * Update ISO20022 validation settings
   */
  async updateISO20022Settings(req: Request, res: Response, next: NextFunction) {
    try {
      const { criteria, enabled } = req.body as {
        criteria?: {
          senderDN?: string;
          senderFullName?: string;
          receiverDN?: string;
          receiverFullName?: string;
        };
        enabled?: boolean;
      };

      const result = await settingsService.updateISO20022Settings(criteria ?? {}, enabled);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/settings/validation/swift-mt
   * Update SWIFT MT validation settings
   */
  async updateSwiftMTSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { criteria, enabled } = req.body as {
        criteria?: {
          senderBIC?: string;
          receiverBIC?: string;
          validateFormat?: boolean;
          expectedFormat?: 'dos_pcc' | 'rje' | 'fin' | null;
        };
        enabled?: boolean;
      };

      const result = await settingsService.updateSwiftMTSettings(criteria ?? {}, enabled);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/settings/validation/reset
   * Reset validation settings to defaults
   */
  async resetValidationSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await settingsService.resetValidationSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/settings
   * Get all settings
   */
  async getAllSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await settingsService.getAllSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/settings/tools/general
   * Get tools general settings (base salary, etc.)
   */
  async getToolsGeneralSettings(_req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await settingsService.getToolsGeneralSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/settings/tools/general
   * Update tools general settings
   */
  async updateToolsGeneralSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { baseSalary } = req.body as Partial<ToolsGeneralSettings>;

      // Validate baseSalary
      if (baseSalary !== undefined && baseSalary !== null) {
        if (typeof baseSalary !== 'number' || baseSalary <= 0) {
          res.status(400).json({
            code: 'INVALID_BASE_SALARY',
            message: 'Base salary must be a positive number or null'
          });
          return;
        }
      }

      const result = await settingsService.updateToolsGeneralSettings({ baseSalary });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
};
