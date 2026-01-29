import { modeAwareAuthProvider } from '../auth/mode-aware-auth.provider.js';
import { modeService } from '../services/mode.service.js';
import { sessionService } from '../services/session.service.js';
import { authLogger } from '../utils/logger.js';

import type { AuthenticatedUser } from '@workspace/shared';
import type { Request, Response, NextFunction } from 'express';

/**
 * Extended Request interface with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  userId?: string;
  permissions?: string[];
  appMode?: 'solo' | 'shared';
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
      authLogger.warn({ partsLength: parts.length }, 'Invalid auth header format');
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid authorization header format. Use: Bearer <token>'
      });
      return;
    }

    const token = parts[1];

    // Verify token with mode-aware provider
    const decoded = await modeAwareAuthProvider.verifyToken(token);

    // Get user with roles and permissions
    const user = await modeAwareAuthProvider.getUserById(decoded.userId);

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

    // Get mode and session config to determine if we should check session timeout
    const mode = await modeService.getMode();
    const sessionConfig = await sessionService.getConfig();

    // Session Lock controls automatic session expiry:
    // - When disabled: Session never expires automatically (user logs in once, stays logged in)
    // - When enabled: Session will timeout after inactivity period
    // This applies to ALL modes, not just Solo
    const sessionLockEnabled = sessionConfig.enableSessionLock !== false;
    
    if (sessionLockEnabled && mode === 'solo') {
      // Only check session timeout in Solo mode with session lock enabled
      // In Shared mode, external auth systems handle session management
      const sessionInfo = await sessionService.getSessionInfo(user.id);

      if (!sessionInfo || !sessionInfo.isActive) {
        res.status(401).json({
          code: 'SESSION_EXPIRED',
          message: 'Session has expired or timed out due to inactivity'
        });
        return;
      }
    }

    // Attach user, permissions, and mode to request
    req.user = user;
    req.userId = user.id;
    req.permissions = user.permissions;
    req.appMode = user.mode;

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
    const decoded = await modeAwareAuthProvider.verifyToken(token);

    const user = await modeAwareAuthProvider.getUserById(decoded.userId);

    if (user && user.isActive) {
      req.user = user;
      req.userId = user.id;
      req.permissions = user.permissions;
      req.appMode = user.mode;
    }

    next();
  } catch {
    // Ignore errors for optional auth
    next();
  }
};

/**
 * Alias for authMiddleware - used by team routes
 */
export const requireAuth = authMiddleware;
