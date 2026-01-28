import { Router } from 'express';

import { localAuthProvider } from '../../auth/local-auth.provider.js';
import { modeAwareAuthProvider } from '../../auth/mode-aware-auth.provider.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { loginSchema, refreshTokenSchema, changePasswordSchema, resetPasswordWithKeySchema, deleteAccountSchema } from '../../schemas/auth.schema.js';
import { attestationService } from '../../services/attestation.service.js';
import { modeService } from '../../services/mode.service.js';
import { sessionService } from '../../services/session.service.js';

import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import type { LoginRequest, RefreshTokenRequest, ChangePasswordRequest, LocalUserResetRequest, ResetPasswordWithKeyRequest, DeleteAccountRequest } from '@workspace/shared';
import type { Request, Response } from 'express';

export const authRouter = Router();

/**
 * POST /auth/login
 * Authenticate user
 */
authRouter.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as LoginRequest;

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Always use local auth
    const result = await modeAwareAuthProvider.login(body, { ipAddress, userAgent });

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';

    res.status(401).json({
      code: 'UNAUTHORIZED',
      message
    });
  }
});

/**
 * POST /auth/logout
 * Invalidate current session - always local
 */
authRouter.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body as { refreshToken?: string };

    if (body.refreshToken) {
      await modeAwareAuthProvider.logout(body.refreshToken);
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

    const mode = await modeService.getMode();

    res.json({
      user: req.user,
      permissions: req.permissions,
      mode
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
authRouter.post('/refresh', validate(refreshTokenSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as RefreshTokenRequest;

    const result = await modeAwareAuthProvider.refreshToken(body.refreshToken);

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
 * POST /auth/reset-password
 * Reset password using recovery key (no auth required)
 */
authRouter.post('/reset-password', validate(resetPasswordWithKeySchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as ResetPasswordWithKeyRequest;

    await localAuthProvider.resetPasswordWithKey(body.username, body.recoveryKey, body.newPassword);

    res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Password reset failed';

    // Map internal error codes to user-friendly messages
    if (message === 'USER_NOT_FOUND') {
      res.status(404).json({
        code: 'USER_NOT_FOUND',
        message: 'No account found with that username or email'
      });
      return;
    }

    if (message === 'RECOVERY_NOT_AVAILABLE') {
      res.status(400).json({
        code: 'RECOVERY_NOT_AVAILABLE',
        message: 'Password recovery is not available for this account'
      });
      return;
    }

    if (message === 'INVALID_RECOVERY_KEY') {
      res.status(401).json({
        code: 'INVALID_RECOVERY_KEY',
        message: 'The recovery key is invalid'
      });
      return;
    }

    res.status(400).json({
      code: 'RESET_FAILED',
      message
    });
  }
});

/**
 * POST /auth/generate-recovery-key
 * Generate a new recovery key for the authenticated user
 */
authRouter.post('/generate-recovery-key', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated'
      });
      return;
    }

    const recoveryKey = await localAuthProvider.generateNewRecoveryKey(req.userId);

    res.json({
      success: true,
      recoveryKey,
      message: 'New recovery key generated successfully. The old key is now invalid.'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate recovery key';
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message
    });
  }
});

/**
 * POST /auth/delete-account
 * Delete user account permanently (Danger Zone)
 */
authRouter.post('/delete-account', authMiddleware, validate(deleteAccountSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated'
      });
      return;
    }

    const body = req.body as DeleteAccountRequest;

    await localAuthProvider.deleteUser(req.userId, body.password);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete account';
    
    if (message === 'INVALID_PASSWORD') {
      res.status(401).json({
        code: 'INVALID_PASSWORD',
        message: 'Use your current password to confirm deletion'
      });
      return;
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
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
  validate(changePasswordSchema),
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

      // Password validation (min 8 chars) is handled by Zod schema
      await localAuthProvider.changePassword(req.userId, body.currentPassword, body.newPassword);

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
 * POST /auth/session-config
 * Update session configuration
 */
authRouter.post('/session-config', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.userId) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated'
      });
      return;
    }

    const body = req.body;
    const config = await sessionService.updateConfig(body);
    res.json({ success: true, config });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update session config';
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
