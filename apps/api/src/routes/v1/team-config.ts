import { Router } from 'express';

import { teamConfigService } from '../../services/team-config.service.js';
import { testConnection, initializeSharedDb, isSharedDbConnected, getSharedPool } from '../../db/shared-client.js';
import { runSharedMigrations } from '../../db/shared-migrations/index.js';
import { settingsRepository } from '../../repositories/settings.repository.js';

import type { Request, Response } from 'express';

const teamConfigRouter = Router();

const extractConnectionString = (req: Request): string | null => {
  const { connectionString } = req.body ?? {};
  if (typeof connectionString !== 'string' || !connectionString.trim()) {
    return null;
  }
  return connectionString.trim();
};

/**
 * GET /team-config/status
 * Get current team/shared configuration status
 */
teamConfigRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await teamConfigService.getStatus();
    res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get status';
    res.status(500).json({ success: false, message });
  }
});

/**
 * POST /team-config/test
 * Test a PostgreSQL connection string
 */
teamConfigRouter.post('/test', async (req: Request, res: Response) => {
  const connectionString = extractConnectionString(req);

  if (!connectionString) {
    res.status(400).json({ success: false, message: 'connectionString is required' });
    return;
  }

  try {
    await testConnection(connectionString);
    res.json({ success: true, message: 'Connection successful' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    res.status(400).json({ success: false, message });
  }
});

/**
 * POST /team-config/configure
 * Configure and enable shared mode with a connection string
 */
teamConfigRouter.post('/configure', async (req: Request, res: Response) => {
  const connectionString = extractConnectionString(req);

  if (!connectionString) {
    res.status(400).json({ success: false, message: 'connectionString is required' });
    return;
  }

  try {
    const result = await teamConfigService.connectExistingTeam(connectionString);
    res.json({
      success: true,
      message: result.needsTeamSetup
        ? 'Connection saved. Team setup is required on this database.'
        : 'Shared mode enabled successfully.',
      ...result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to enable shared mode';
    res.status(400).json({ success: false, message });
  }
});

/**
 * POST /team-config/reconnect
 * Reconnect to the shared database using stored connection string
 */
teamConfigRouter.post('/reconnect', async (_req: Request, res: Response) => {
  try {
    // Get stored connection string
    const setting = await settingsRepository.get<string>('shared_db_connection');
    const connectionString = setting?.value;

    if (!connectionString) {
      res.status(400).json({ 
        success: false, 
        message: 'No connection string configured. Please configure shared mode first.' 
      });
      return;
    }

    // Try to reconnect
    await initializeSharedDb(connectionString);
    
    res.json({ 
      success: true, 
      message: 'Reconnected to shared database successfully',
      connected: isSharedDbConnected()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reconnect';
    res.status(500).json({ success: false, message });
  }
});

/**
 * POST /team-config/run-migrations
 * Run pending shared database migrations
 */
teamConfigRouter.post('/run-migrations', async (_req: Request, res: Response) => {
  try {
    if (!isSharedDbConnected()) {
      res.status(400).json({ 
        success: false, 
        message: 'Shared database not connected. Please reconnect first.' 
      });
      return;
    }

    const pool = getSharedPool();
    const migrationsRun = await runSharedMigrations(pool);
    
    res.json({ 
      success: true, 
      message: migrationsRun.length > 0 
        ? `Successfully ran ${migrationsRun.length} migration(s): ${migrationsRun.join(', ')}` 
        : 'All migrations are already up to date',
      migrationsRun
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run migrations';
    res.status(500).json({ success: false, message });
  }
});

/**
 * POST /team-config/disable
 * Disable shared mode and return to solo mode
 */
teamConfigRouter.post('/disable', async (_req: Request, res: Response) => {
  try {
    const result = await teamConfigService.disable();
    if (result.success) {
      res.json(result);
      return;
    }
    res.status(400).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to disable shared mode';
    res.status(500).json({ success: false, message });
  }
});

teamConfigRouter.post('/run-migrations', async (_req: Request, res: Response) => {
  try {
    const { runSharedMigrations } = await import('../../db/shared-migrations/index.js');
    const { isSharedDbConnected, getSharedPool } = await import('../../db/shared-client.js');
    
    if (!isSharedDbConnected()) {
      res.status(400).json({
        success: false,
        message: 'Shared database is not connected'
      });
      return;
    }

    const pool = getSharedPool();
    const migrationsRun = await runSharedMigrations(pool);

    res.json({
      success: true,
      message: `Successfully ran ${migrationsRun.length} migrations`,
      migrations: migrationsRun
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run migrations';
    res.status(500).json({ success: false, message });
  }
});

export default teamConfigRouter;
