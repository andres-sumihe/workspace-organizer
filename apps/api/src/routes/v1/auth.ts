import { Router } from 'express';

import { modeAwareAuthProvider } from '../../auth/mode-aware-auth.provider.js';
import { localAuthProvider } from '../../auth/local-auth.provider.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { attestationService } from '../../services/attestation.service.js';
import { auditService } from '../../services/audit.service.js';
import { authService } from '../../services/auth.service.js';
import { modeService } from '../../services/mode.service.js';
import { sessionService } from '../../services/session.service.js';

import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import type { LoginRequest, RefreshTokenRequest, ChangePasswordRequest, LocalUserResetRequest } from '@workspace/shared';
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

    // Use mode-aware auth provider with login context
    const result = await modeAwareAuthProvider.login(body, { ipAddress, userAgent });

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

/**
 * GET /auth/session-config
 * Get session timeout configuration
 */
authRouter.get('/session-config', async (_req: Request, res: Response) => {
  try {
    const config = await sessionService.getConfig();
    res.json(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get session config';
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message
    });
  }
});

/**
 * POST /auth/heartbeat
 * Record session activity to prevent timeout
 */
authRouter.post('/heartbeat', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mode = req.appMode || 'solo';
    
    // Only record heartbeat in solo mode (local sessions)
    if (mode !== 'solo') {
      res.json({ success: true, mode: 'shared' });
      return;
    }

    if (!req.userId) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated'
      });
      return;
    }

    // Record activity using user ID (session tracking)
    await sessionService.recordActivity(req.userId);
    
    // Check if session is still valid
    const sessionValid = await sessionService.checkSession(req.userId);
    
    if (!sessionValid) {
      res.status(401).json({
        code: 'SESSION_EXPIRED',
        message: 'Session has expired due to inactivity'
      });
      return;
    }

    res.json({ 
      success: true, 
      sessionValid: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record heartbeat';
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message
    });
  }
});

/**
 * POST /auth/team-attest
 * Generate signed attestation for team database binding (Shared mode - team server)
 * This endpoint is called by a client to get attestation from the connected team DB
 */
authRouter.post('/team-attest', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mode = req.appMode || 'solo';
    
    // Attestation is generated by the shared server for clients joining
    if (mode !== 'shared') {
      res.status(400).json({
        code: 'INVALID_MODE',
        message: 'Team attestation can only be generated in Shared mode (by team server)'
      });
      return;
    }

    if (!req.userId || !req.user) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated'
      });
      return;
    }

    // Generate attestation for this user from the shared server
    const attestation = await attestationService.generateAttestation(req.userId);

    res.json(attestation);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate attestation';
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message
    });
  }
});

/**
 * POST /auth/verify-attest
 * Verify an attestation signature using stored public key
 */
authRouter.post('/verify-attest', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body as { attestation: { payload: unknown; signature: string }; publicKey: string };
    
    if (!body.attestation || !body.publicKey) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Attestation and public key are required'
      });
      return;
    }

    // Verify the signature
    const isValid = attestationService.verifyAttestation(
      body.attestation as { payload: unknown; signature: string },
      body.publicKey
    );

    res.json({ 
      valid: isValid,
      verifiedAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify attestation';
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message
    });
  }
});

/**
 * POST /auth/reset-local-data
 * Reset all local user data (Solo mode only) - requires confirmation phrase
 */
authRouter.post('/reset-local-data', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mode = req.appMode || 'solo';
    
    if (mode !== 'solo') {
      res.status(400).json({
        code: 'INVALID_MODE',
        message: 'Local data reset is only available in Solo mode'
      });
      return;
    }

    const body = req.body as LocalUserResetRequest;
    
    if (!body.confirmPhrase) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Confirmation phrase is required'
      });
      return;
    }

    await localAuthProvider.resetLocalData(body.confirmPhrase);

    res.json({ 
      success: true, 
      message: 'Local data has been reset. Please restart the application.'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reset local data';
    res.status(400).json({
      code: 'VALIDATION_ERROR',
      message
    });
  }
});

/**
 * GET /auth/session-status
 * Check current session status including timeout info
 */
authRouter.get('/session-status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mode = req.appMode || 'solo';
    
    if (mode !== 'solo') {
      res.json({ 
        mode: 'shared',
        sessionManaged: false,
        message: 'Session management is handled by shared authentication'
      });
      return;
    }

    if (!req.userId) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated'
      });
      return;
    }

    const sessionInfo = await sessionService.getSessionInfo(req.userId);
    const config = await sessionService.getConfig();

    res.json({
      mode: 'solo',
      sessionManaged: true,
      session: sessionInfo,
      config: {
        inactivityTimeoutMinutes: config.inactivityTimeoutMinutes,
        heartbeatIntervalSeconds: config.heartbeatIntervalSeconds
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get session status';
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message
    });
  }
});
