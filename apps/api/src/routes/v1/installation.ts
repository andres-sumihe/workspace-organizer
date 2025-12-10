import { Router } from 'express';

import { installationService } from '../../services/installation.service.js';

import type { ConfigureInstallationRequest, TestConnectionRequest } from '@workspace/shared';
import type { Request, Response } from 'express';

export const installationRouter = Router();

/**
 * GET /installation/status
 * Get current installation status
 */
installationRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await installationService.getStatus();
    res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get installation status';
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message
    });
  }
});

/**
 * POST /installation/test-connection
 * Test PostgreSQL connection
 */
installationRouter.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const body = req.body as TestConnectionRequest;

    // Validate required fields
    if (!body.host || !body.port || !body.database || !body.user || !body.password) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Missing required connection parameters',
        details: [
          { field: 'host', message: 'Host is required' },
          { field: 'port', message: 'Port is required' },
          { field: 'database', message: 'Database name is required' },
          { field: 'user', message: 'Username is required' },
          { field: 'password', message: 'Password is required' }
        ].filter((d) => !body[d.field as keyof TestConnectionRequest])
      });
      return;
    }

    const result = await installationService.testConnection(body);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection test failed';
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message
    });
  }
});

/**
 * POST /installation/configure
 * Configure the installation (one-time setup)
 */
installationRouter.post('/configure', async (req: Request, res: Response) => {
  try {
    // Check if already configured
    const isConfigured = await installationService.isConfigured();
    if (isConfigured) {
      res.status(400).json({
        code: 'ALREADY_CONFIGURED',
        message: 'Installation has already been completed'
      });
      return;
    }

    const body = req.body as ConfigureInstallationRequest;

    // Validate database config
    if (!body.database) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Database configuration is required'
      });
      return;
    }

    const { database, adminUser } = body;

    if (!database.host || !database.port || !database.database || !database.user || !database.password) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Missing required database configuration',
        details: [
          { field: 'database.host', message: 'Host is required' },
          { field: 'database.port', message: 'Port is required' },
          { field: 'database.database', message: 'Database name is required' },
          { field: 'database.user', message: 'Username is required' },
          { field: 'database.password', message: 'Password is required' }
        ].filter((d) => {
          const key = d.field.split('.')[1] as keyof TestConnectionRequest;
          return !database[key];
        })
      });
      return;
    }

    // Validate admin user config
    if (!adminUser) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Admin user configuration is required'
      });
      return;
    }

    if (!adminUser.username || !adminUser.email || !adminUser.password) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Missing required admin user configuration',
        details: [
          !adminUser.username && { field: 'adminUser.username', message: 'Username is required' },
          !adminUser.email && { field: 'adminUser.email', message: 'Email is required' },
          !adminUser.password && { field: 'adminUser.password', message: 'Password is required' }
        ].filter(Boolean)
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminUser.email)) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid email format'
      });
      return;
    }

    const result = await installationService.configure(body);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Installation failed';
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message
    });
  }
});
