import { Router } from 'express';

import { modeAwareAuthProvider } from '../../auth/mode-aware-auth.provider.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { auditService } from '../../services/audit.service.js';
import { authService } from '../../services/auth.service.js';
import { modeService } from '../../services/mode.service.js';

import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import type { LoginRequest, RefreshTokenRequest, ChangePasswordRequest } from '@workspace/shared';
import type { Request, Response } from 'express';

export const authRouter = Router();

/**
 * POST /auth/login
 * Authenticate user and return tokens (mode-aware)
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

    // Use mode-aware auth provider
    const result = await modeAwareAuthProvider.login(body);

    // Log successful login (only in shared mode)
    const mode = await modeService.getMode();
    if (mode === 'shared') {
      await auditService.logLogin(result.user.id, true, {
        ipAddress,
        userAgent,
        metadata: { username: body.username }
      });
    }

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';

    // Try to log failed login attempt (only in shared mode)
    try {
      const mode = await modeService.getMode();
      if (mode === 'shared') {
        const user = await authService.getUserByUsername(req.body?.username);
        if (user) {
          await auditService.logLogin(user.id, false, {
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            metadata: { error: message }
          });
        }
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
 * Invalidate current session (mode-aware)
 */
authRouter.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body as { refreshToken?: string };
    const mode = req.appMode || 'solo';

    if (body.refreshToken) {
      await modeAwareAuthProvider.logout(body.refreshToken, mode);
    }

    // Log logout (only in shared mode)
    if (mode === 'shared' && req.userId) {
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
 * Refresh access token using refresh token (mode-aware)
 */
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const body = req.body as RefreshTokenRequest & { mode?: 'solo' | 'shared' };

    if (!body.refreshToken) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Refresh token is required'
      });
      return;
    }

    // Determine mode from request or detect from token
    const mode = body.mode || (await modeService.getMode());
    const result = await modeAwareAuthProvider.refreshToken(body.refreshToken, mode);

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
