import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { auditService } from '../../services/audit.service.js';

import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import type { AuditLogFilters } from '@workspace/shared';
import type { Response } from 'express';

export const auditRouter = Router();

// All audit routes require authentication
auditRouter.use(authMiddleware);

/**
 * GET /audit
 * Get all audit log entries with optional filters
 * Requires: audit:read permission
 */
auditRouter.get(
  '/',
  requirePermission('audit', 'read'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string, 10) || 50, 100);

      const filters: AuditLogFilters = {};

      if (req.query.memberEmail) {
        filters.memberEmail = req.query.memberEmail as string;
      }

      if (req.query.teamId) {
        filters.teamId = req.query.teamId as string;
      }

      if (req.query.action) {
        filters.action = req.query.action as AuditLogFilters['action'];
      }

      if (req.query.resourceType) {
        filters.resourceType = req.query.resourceType as string;
      }

      if (req.query.resourceId) {
        filters.resourceId = req.query.resourceId as string;
      }

      if (req.query.fromDate) {
        filters.fromDate = req.query.fromDate as string;
      }

      if (req.query.toDate) {
        filters.toDate = req.query.toDate as string;
      }

      const result = await auditService.getAll(filters, page, pageSize);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get audit logs';
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message
      });
    }
  }
);

/**
 * GET /audit/recent
 * Get recent audit log entries (last 24 hours)
 * Requires: audit:read permission
 */
auditRouter.get(
  '/recent',
  requirePermission('audit', 'read'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
      const entries = await auditService.getRecent(limit);
      res.json({ items: entries });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get recent audit logs';
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message
      });
    }
  }
);

/**
 * GET /audit/resource/:resourceType/:resourceId
 * Get audit log entries for a specific resource
 * Requires: audit:read permission
 */
auditRouter.get(
  '/resource/:resourceType/:resourceId',
  requirePermission('audit', 'read'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const resourceType = req.params.resourceType as string;
      const resourceId = req.params.resourceId as string;
      const page = parseInt(req.query.page as string, 10) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string, 10) || 50, 100);

      const result = await auditService.getByResource(resourceType, resourceId, page, pageSize);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get resource audit logs';
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message
      });
    }
  }
);

/**
 * GET /audit/user/:userId
 * Get audit log entries for a specific user/member (by email)
 * Requires: audit:read permission
 * 
 * Note: Since auth is local, userId should be treated as an email
 */
auditRouter.get(
  '/user/:userId',
  requirePermission('audit', 'read'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.params.userId as string;
      const page = parseInt(req.query.page as string, 10) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string, 10) || 50, 100);

      // userId is now treated as email (member_email in shared DB)
      const result = await auditService.getByMember(userId, page, pageSize);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get user audit logs';
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message
      });
    }
  }
);
