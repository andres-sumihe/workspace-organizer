import { Router } from 'express';

import { authMiddleware } from '../../middleware/auth.middleware.js';
import { auditService } from '../../services/audit.service.js';
import { authService } from '../../services/auth.service.js';

import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import type { LoginRequest, RefreshTokenRequest, ChangePasswordRequest } from '@workspace/shared';
import type { Request, Response } from 'express';

export const authRouter = Router();

/**
 * POST /auth/login
 * Authenticate user and return tokens
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const body = req.body as LoginRequest;

    if (!body.username || !body.password) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Username and password are required'
      });
      return;
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await authService.login(body, ipAddress, userAgent);

    // Log successful login
    await auditService.logLogin(result.user.id, true, {
      ipAddress,
      userAgent,
      metadata: { username: body.username }
    });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';

    // Try to log failed login attempt
    try {
      const user = await authService.getUserByUsername(req.body?.username);
      if (user) {
        await auditService.logLogin(user.id, false, {
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
          metadata: { error: message }
        });
      }
    } catch {
      // Ignore logging errors
    }

    res.status(401).json({
      code: 'UNAUTHORIZED',
      message
    });
  }
});

/**
 * POST /auth/logout
 * Invalidate current session
 */
authRouter.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (token) {
      await authService.logout(token);
    }

    // Log logout
    if (req.userId) {
      await auditService.logLogout(req.userId, {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      });
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (_error) {
    // Always succeed logout even if there's an error
    res.json({ success: true, message: 'Logged out successfully' });
  }
});

/**
 * GET /auth/me
 * Get current authenticated user
 */
authRouter.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated'
      });
      return;
    }

    res.json({
      user: req.user,
      permissions: req.permissions
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get user';
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const body = req.body as RefreshTokenRequest;

    if (!body.refreshToken) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Refresh token is required'
      });
      return;
    }

    const result = await authService.refreshToken(body.refreshToken);

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token refresh failed';
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message
    });
  }
});

/**
 * POST /auth/change-password
 * Change current user's password
 */
authRouter.post(
  '/change-password',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated'
        });
        return;
      }

      const body = req.body as ChangePasswordRequest;

      if (!body.currentPassword || !body.newPassword) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Current password and new password are required'
        });
        return;
      }

      // Validate new password strength
      const validation = authService.validatePassword(body.newPassword);
      if (!validation.valid) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Password does not meet requirements',
          details: validation.errors.map((e) => ({ message: e }))
        });
        return;
      }

      await authService.changePassword(req.userId, body.currentPassword, body.newPassword);

      // Log password change
      await auditService.log({
        userId: req.userId,
        action: 'PASSWORD_CHANGED',
        resourceType: 'user',
        resourceId: req.userId,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      });

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to change password';
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message
      });
    }
  }
);
