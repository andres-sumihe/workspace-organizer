import { authService } from '../services/auth.service.js';

import type { UserWithRoles, Permission } from '@workspace/shared';
import type { Request, Response, NextFunction } from 'express';

/**
 * Extended Request interface with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: UserWithRoles;
  userId?: string;
  permissions?: Permission[];
}

/**
 * Authentication middleware
 * Extracts and validates JWT token from Authorization header
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'No authorization token provided'
      });
      return;
    }

    // Extract Bearer token
    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid authorization header format. Use: Bearer <token>'
      });
      return;
    }

    const token = parts[1];

    // Verify token
    const decoded = await authService.verifyToken(token);

    if (decoded.type !== 'access') {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid token type'
      });
      return;
    }

    // Get user with roles
    const user = await authService.getUserById(decoded.userId);

    if (!user) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User not found'
      });
      return;
    }

    if (!user.isActive) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'User account is deactivated'
      });
      return;
    }

    // Get user permissions
    const permissions = await authService.getUserPermissions(user.id);

    // Attach user and permissions to request
    req.user = user;
    req.userId = user.id;
    req.permissions = permissions;

    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired'
        });
        return;
      }

      if (error.name === 'JsonWebTokenError') {
        res.status(401).json({
          code: 'INVALID_TOKEN',
          message: 'Invalid access token'
        });
        return;
      }
    }

    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Authentication failed'
    });
  }
};

/**
 * Optional auth middleware - attaches user if token is present, but doesn't require it
 */
export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      next();
      return;
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      next();
      return;
    }

    const token = parts[1];
    const decoded = await authService.verifyToken(token);

    if (decoded.type === 'access') {
      const user = await authService.getUserById(decoded.userId);

      if (user && user.isActive) {
        const permissions = await authService.getUserPermissions(user.id);
        req.user = user;
        req.userId = user.id;
        req.permissions = permissions;
      }
    }

    next();
  } catch {
    // Ignore errors for optional auth
    next();
  }
};
