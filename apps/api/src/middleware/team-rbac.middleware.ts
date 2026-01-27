import { rbacService } from '../services/rbac.service.js';

import type { AuthenticatedRequest } from './auth.middleware.js';
import type { TeamRole, TeamResource, TeamAction } from '@workspace/shared';
import type { Response, NextFunction } from 'express';

/**
 * Extended request with team RBAC context
 */
export interface TeamAuthenticatedRequest extends AuthenticatedRequest {
  teamId?: string;
  teamRole?: TeamRole;
  memberEmail?: string;
}

/**
 * Middleware factory: Require team membership with minimum role
 * 
 * Usage:
 *   router.get('/teams/:teamId/scripts', requireTeamRole('member'), handler)
 *   router.post('/teams/:teamId/scripts', requireTeamRole('member'), handler)
 *   router.delete('/teams/:teamId', requireTeamRole('owner'), handler)
 * 
 * Expects:
 *   - req.user.email from auth middleware
 *   - req.params.teamId in route
 * 
 * Sets:
 *   - req.teamId
 *   - req.teamRole
 *   - req.memberEmail
 */
export const requireTeamRole = (minRole: TeamRole) => {
  return async (
    req: TeamAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const teamId = req.params.teamId as string;
      const userEmail = req.user?.email;

      if (!teamId) {
        res.status(400).json({
          code: 'MISSING_TEAM_ID',
          message: 'Team ID is required in request parameters'
        });
        return;
      }

      if (!userEmail) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'User email not found in authentication context'
        });
        return;
      }

      // Get member role
      const role = await rbacService.getMemberRole(teamId, userEmail);

      if (!role) {
        res.status(403).json({
          code: 'NOT_A_MEMBER',
          message: 'You are not a member of this team'
        });
        return;
      }

      // Check minimum role
      const hasRole = await rbacService.hasMinimumRole(teamId, userEmail, minRole);
      if (!hasRole) {
        res.status(403).json({
          code: 'INSUFFICIENT_ROLE',
          message: `This action requires at least '${minRole}' role`
        });
        return;
      }

      // Attach team context to request
      req.teamId = teamId;
      req.teamRole = role;
      req.memberEmail = userEmail;

      next();
    } catch (error) {
      if (error instanceof Error && error.name === 'ForbiddenError') {
        res.status(403).json({
          code: 'FORBIDDEN',
          message: error.message
        });
        return;
      }

      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to check team permissions'
      });
    }
  };
};

/**
 * Middleware factory: Require permission for a specific resource action
 * 
 * Usage:
 *   router.post('/teams/:teamId/scripts', requireTeamPermission('scripts', 'create'), handler)
 *   router.delete('/teams/:teamId/scripts/:id', requireTeamPermission('scripts', 'delete'), handler)
 */
export const requireTeamPermission = (resource: TeamResource, action: TeamAction) => {
  return async (
    req: TeamAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const teamId = req.params.teamId as string;
      const userEmail = req.user?.email;

      if (!teamId) {
        res.status(400).json({
          code: 'MISSING_TEAM_ID',
          message: 'Team ID is required in request parameters'
        });
        return;
      }

      if (!userEmail) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'User email not found in authentication context'
        });
        return;
      }

      // Check permission
      const hasPermission = await rbacService.hasPermission(teamId, userEmail, resource, action);

      if (!hasPermission) {
        res.status(403).json({
          code: 'PERMISSION_DENIED',
          message: `You do not have permission to ${action} ${resource}`
        });
        return;
      }

      // Get and attach role
      const role = await rbacService.getMemberRole(teamId, userEmail);
      req.teamId = teamId;
      req.teamRole = role ?? undefined;
      req.memberEmail = userEmail;

      next();
    } catch (_) {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to check permissions'
      });
    }
  };
};

/**
 * Middleware: Require membership in at least one team
 * 
 * Usage:
 *   router.get('/my-teams', requireTeamMembership, handler)
 */
export const requireTeamMembership = async (
  req: TeamAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userEmail = req.user?.email;

    if (!userEmail) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User email not found in authentication context'
      });
      return;
    }

    const isMember = await rbacService.isMemberOfAnyTeam(userEmail);

    if (!isMember) {
      res.status(403).json({
        code: 'NO_TEAM_MEMBERSHIP',
        message: 'You must be a member of at least one team to access this resource'
      });
      return;
    }

    req.memberEmail = userEmail;
    next();
  } catch (_) {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Failed to check team membership'
    });
  }
};

/**
 * Middleware factory: Check resource ownership for 'member' role
 * 
 * For update/delete operations, 'member' role can only modify their own resources.
 * 'admin' and 'owner' can modify any resource.
 * 
 * Usage:
 *   router.put('/teams/:teamId/scripts/:id', 
 *     requireTeamRole('member'),
 *     requireResourceOwnership('scripts', 'update', getScriptOwner),
 *     handler
 *   )
 * 
 * @param resource - The resource type being accessed
 * @param action - The action being performed
 * @param getOwnerEmail - Async function to get the owner's email from the request
 */
export const requireResourceOwnership = (
  resource: TeamResource,
  action: TeamAction,
  getOwnerEmail: (req: TeamAuthenticatedRequest) => Promise<string | undefined>
) => {
  return async (
    req: TeamAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Admin and owner can always proceed
      if (req.teamRole === 'admin' || req.teamRole === 'owner') {
        next();
        return;
      }

      // For 'member' role, check ownership
      if (req.teamRole === 'member') {
        const ownerEmail = await getOwnerEmail(req);

        if (!ownerEmail) {
          res.status(404).json({
            code: 'RESOURCE_NOT_FOUND',
            message: `${resource} not found`
          });
          return;
        }

        if (ownerEmail !== req.memberEmail) {
          res.status(403).json({
            code: 'NOT_OWNER',
            message: `You can only ${action} your own ${resource}`
          });
          return;
        }
      }

      next();
    } catch (_) {
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Failed to verify resource ownership'
      });
    }
  };
};
