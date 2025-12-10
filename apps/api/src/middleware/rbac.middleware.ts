import type { AuthenticatedRequest } from './auth.middleware.js';
import type { ResourceType, ActionType } from '@workspace/shared';
import type { Response, NextFunction } from 'express';


/**
 * RBAC (Role-Based Access Control) middleware factory
 *
 * Creates middleware that checks if the authenticated user has the required permission.
 * Must be used after authMiddleware.
 *
 * @param resource - The resource type (scripts, controlm_jobs, users, roles, audit)
 * @param action - The action type (create, read, update, delete, execute, manage)
 * @returns Express middleware function
 *
 * @example
 * router.get('/scripts', authMiddleware, requirePermission('scripts', 'read'), getScripts);
 * router.post('/scripts', authMiddleware, requirePermission('scripts', 'create'), createScript);
 */
export const requirePermission = (resource: ResourceType, action: ActionType) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Check if user is authenticated
    if (!req.user || !req.permissions) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    // Check if user has the required permission
    const hasPermission = req.permissions.some(
      (p) => p.resource === resource && p.action === action
    );

    // Also check for 'manage' permission which grants all actions
    const hasManagePermission = req.permissions.some(
      (p) => p.resource === resource && p.action === 'manage'
    );

    if (!hasPermission && !hasManagePermission) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: `You don't have permission to ${action} ${resource}`,
        details: [
          {
            field: 'permission',
            code: 'MISSING_PERMISSION',
            message: `Required permission: ${resource}:${action}`
          }
        ]
      });
      return;
    }

    next();
  };
};

/**
 * Require any of the specified permissions
 *
 * @param permissions - Array of [resource, action] tuples
 * @returns Express middleware function
 *
 * @example
 * router.get('/admin', authMiddleware, requireAnyPermission([
 *   ['users', 'manage'],
 *   ['roles', 'manage']
 * ]), adminDashboard);
 */
export const requireAnyPermission = (
  permissions: Array<[ResourceType, ActionType]>
) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !req.permissions) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    const hasAnyPermission = permissions.some(([resource, action]) => {
      return req.permissions!.some(
        (p) =>
          (p.resource === resource && p.action === action) ||
          (p.resource === resource && p.action === 'manage')
      );
    });

    if (!hasAnyPermission) {
      const required = permissions.map(([r, a]) => `${r}:${a}`).join(' OR ');
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You don\'t have the required permissions',
        details: [
          {
            field: 'permission',
            code: 'MISSING_PERMISSION',
            message: `Required one of: ${required}`
          }
        ]
      });
      return;
    }

    next();
  };
};

/**
 * Require all of the specified permissions
 *
 * @param permissions - Array of [resource, action] tuples
 * @returns Express middleware function
 */
export const requireAllPermissions = (
  permissions: Array<[ResourceType, ActionType]>
) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !req.permissions) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
      return;
    }

    const missingPermissions = permissions.filter(([resource, action]) => {
      return !req.permissions!.some(
        (p) =>
          (p.resource === resource && p.action === action) ||
          (p.resource === resource && p.action === 'manage')
      );
    });

    if (missingPermissions.length > 0) {
      const missing = missingPermissions.map(([r, a]) => `${r}:${a}`).join(', ');
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You don\'t have all required permissions',
        details: [
          {
            field: 'permission',
            code: 'MISSING_PERMISSION',
            message: `Missing permissions: ${missing}`
          }
        ]
      });
      return;
    }

    next();
  };
};

/**
 * Require admin role (shorthand for users:manage permission)
 */
export const requireAdmin = requirePermission('users', 'manage');
