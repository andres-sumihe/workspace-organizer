import { Router } from 'express';

import { localAuthProvider } from '../../auth/local-auth.provider.js';
import { setupService } from '../../services/setup.service.js';

const router = Router();

/**
 * GET /api/v1/setup/status
 * Get setup status (whether first-time setup is needed)
 */
router.get('/status', async (_req, res) => {
  try {
    const status = await setupService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Setup status error:', error);
    res.status(500).json({
      code: 'SETUP_STATUS_ERROR',
      message: 'Failed to get setup status'
    });
  }
});

/**
 * POST /api/v1/setup/create-account
 * Create the first local user account
 * 
 * Request body:
 * {
 *   "username": string,
 *   "email": string,
 *   "password": string,
 *   "displayName"?: string
 * }
 */
router.post('/create-account', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'username, email, and password are required'
      });
      return;
    }

    const user = await setupService.createAccount({
      username,
      email,
      password,
      displayName
    });

    // Automatically log in the new user
    const loginResponse = await localAuthProvider.login({ username, password });

    res.status(201).json({
      user,
      auth: loginResponse
    });
  } catch (error) {
    console.error('Create account error:', error);

    if (error instanceof Error) {
      if (error.message === 'SETUP_ALREADY_COMPLETE') {
        res.status(409).json({
          code: 'SETUP_ALREADY_COMPLETE',
          message: 'Setup has already been completed'
        });
        return;
      }

      if (error.message === 'INVALID_USERNAME') {
        res.status(400).json({
          code: 'INVALID_USERNAME',
          message: 'Username must be at least 3 characters'
        });
        return;
      }

      if (error.message === 'INVALID_EMAIL') {
        res.status(400).json({
          code: 'INVALID_EMAIL',
          message: 'Please provide a valid email address'
        });
        return;
      }

      if (error.message === 'WEAK_PASSWORD') {
        res.status(400).json({
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters'
        });
        return;
      }

      if (error.message.includes('UNIQUE constraint failed')) {
        if (error.message.includes('username')) {
          res.status(409).json({
            code: 'USERNAME_EXISTS',
            message: 'Username already exists'
          });
          return;
        }
        if (error.message.includes('email')) {
          res.status(409).json({
            code: 'EMAIL_EXISTS',
            message: 'Email already exists'
          });
          return;
        }
      }
    }

    res.status(500).json({
      code: 'CREATE_ACCOUNT_ERROR',
      message: 'Failed to create account'
    });
  }
});

export default router;
