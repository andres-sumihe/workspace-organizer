import { Router } from 'express';

import {
  testConnection,
  initializeSharedDb,
  isSharedDbConnected,
  getSharedPool
} from '../../db/shared-client.js';
import { SCHEMA_VERSION, MIN_SCHEMA_VERSION } from '../../db/shared-schema.js';
import { getUnifiedSchemaSQL, getUpgradeSQL } from '../../db/shared-migrations/sql-exports.js';
import { settingsRepository } from '../../repositories/settings.repository.js';
import { teamConfigService } from '../../services/team-config.service.js';
import { schemaCompatibilityService } from '../../services/schema-compatibility.service.js';

import type { Request, Response } from 'express';

export const teamConfigRouter = Router();

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
 * POST /team-config/validate-schema
 * Validate schema compatibility without connecting
 */
teamConfigRouter.post('/validate-schema', async (req: Request, res: Response) => {
  const connectionString = extractConnectionString(req);

  if (!connectionString) {
    res.status(400).json({ success: false, message: 'connectionString is required' });
    return;
  }

  const { Pool } = await import('pg');
  const tempPool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000
  });

  try {
    const compatibility = await schemaCompatibilityService.checkCompatibility(tempPool);
    res.json({
      success: true,
      ...compatibility
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to validate schema';
    res.status(400).json({ success: false, message });
  } finally {
    await tempPool.end();
  }
});

/**
 * GET /team-config/schema-sql
 * Get the unified schema creation SQL for DBAs
 */
teamConfigRouter.get('/schema-sql', (_req: Request, res: Response) => {
  try {
    const sql = getUnifiedSchemaSQL();
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="workspace-organizer-schema-v${SCHEMA_VERSION}.sql"`);
    res.send(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate schema SQL';
    res.status(500).json({ success: false, message });
  }
});

/**
 * GET /team-config/schema-sql/preview
 * Preview the unified schema SQL (JSON response)
 */
teamConfigRouter.get('/schema-sql/preview', (_req: Request, res: Response) => {
  try {
    const sql = getUnifiedSchemaSQL();
    res.json({
      success: true,
      version: SCHEMA_VERSION,
      minVersion: MIN_SCHEMA_VERSION,
      sql,
      instructions: [
        '1. Copy the SQL script above',
        '2. Connect to your PostgreSQL database as a privileged user',
        '3. Execute the script to create the workspace_organizer schema',
        '4. Grant appropriate permissions to application users',
        '5. Provide the connection details to users for registration'
      ]
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate schema SQL';
    res.status(500).json({ success: false, message });
  }
});

/**
 * POST /team-config/upgrade-sql
 * Get upgrade SQL from current version to required version
 */
teamConfigRouter.post('/upgrade-sql', async (req: Request, res: Response) => {
  const { fromVersion } = req.body;

  if (typeof fromVersion !== 'number') {
    res.status(400).json({ success: false, message: 'fromVersion is required (number)' });
    return;
  }

  try {
    const sql = getUpgradeSQL(fromVersion, SCHEMA_VERSION);
    res.json({
      success: true,
      fromVersion,
      toVersion: SCHEMA_VERSION,
      sql
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate upgrade SQL';
    res.status(500).json({ success: false, message });
  }
});

/**
 * POST /team-config/configure
 * Configure and enable shared mode with a connection string
 * NOTE: This validates schema compatibility - users cannot modify schema
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

    // Validate schema after reconnection
    let schemaStatus = null;
    if (isSharedDbConnected()) {
      const pool = getSharedPool();
      schemaStatus = await schemaCompatibilityService.checkCompatibility(pool);
    }

    res.json({
      success: true,
      message: 'Reconnected to shared database successfully',
      connected: isSharedDbConnected(),
      schemaStatus
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reconnect';
    res.status(500).json({ success: false, message });
  }
});

/**
 * GET /team-config/schema-status
 * Get current schema status for connected database
 */
teamConfigRouter.get('/schema-status', async (_req: Request, res: Response) => {
  try {
    if (!isSharedDbConnected()) {
      res.status(400).json({
        success: false,
        message: 'Shared database not connected'
      });
      return;
    }

    const pool = getSharedPool();
    const compatibility = await schemaCompatibilityService.checkCompatibility(pool);

    res.json({
      success: true,
      ...compatibility,
      appSchemaVersion: SCHEMA_VERSION,
      appMinSchemaVersion: MIN_SCHEMA_VERSION
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get schema status';
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
