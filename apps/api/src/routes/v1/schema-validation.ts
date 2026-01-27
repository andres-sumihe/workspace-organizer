import { Router } from 'express';

import { getSharedPool, isSharedDbConnected } from '../../db/shared-client.js';
import { 
  getPendingMigrations,
  getMigrationHistory,
  getExecutedMigrations
} from '../../db/shared-migrations/index.js';
import { 
  MIGRATION_SQLS, 
  SCHEMA_SETUP_SQL,
  getAllMigrationSQL 
} from '../../db/shared-migrations/sql-exports.js';
import { schemaValidationService } from '../../services/schema-validation.service.js';

import type { Request, Response } from 'express';

export const schemaValidationRouter = Router();

// No auth required - these are read-only informational endpoints

/**
 * GET /api/v1/schema-validation/validate
 * Validate all shared database tables against expected schemas
 */
schemaValidationRouter.get('/validate', async (_req: Request, res: Response) => {
  try {
    if (!isSharedDbConnected()) {
      return res.status(503).json({
        success: false,
        message: 'Shared database is not connected',
        valid: false,
        tables: {},
        summary: { total: 0, valid: 0, invalid: 0, missing: 0 }
      });
    }
    const validationResult = await schemaValidationService.validateAllTables();
    return res.json(validationResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Schema validation failed';
    return res.status(500).json({
      success: false,
      message,
      valid: false,
      tables: {},
      summary: { total: 0, valid: 0, invalid: 0, missing: 0 }
    });
  }
});

/**
 * GET /api/v1/schema-validation/pending
 * Get list of pending migrations that haven't been executed yet
 */
schemaValidationRouter.get('/pending', async (_req: Request, res: Response) => {
  try {
    if (!isSharedDbConnected()) {
      // Return all migrations as pending if DB not connected
      return res.json({
        success: true,
        pendingMigrations: MIGRATION_SQLS.map(m => m.id),
        count: MIGRATION_SQLS.length,
        dbConnected: false
      });
    }
    const pool = getSharedPool();
    const pending = await getPendingMigrations(pool);
    return res.json({
      success: true,
      pendingMigrations: pending,
      count: pending.length,
      dbConnected: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get pending migrations';
    return res.status(500).json({
      success: false,
      message,
      pendingMigrations: [],
      count: 0
    });
  }
});

/**
 * GET /api/v1/schema-validation/history
 * Get migration execution history (who ran what and when)
 */
schemaValidationRouter.get('/history', async (_req: Request, res: Response) => {
  try {
    if (!isSharedDbConnected()) {
      return res.json({
        success: true,
        history: [],
        dbConnected: false
      });
    }
    const pool = getSharedPool();
    const history = await getMigrationHistory(pool);
    return res.json({
      success: true,
      history,
      dbConnected: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get migration history';
    return res.status(500).json({
      success: false,
      message,
      history: []
    });
  }
});

/**
 * GET /api/v1/schema-validation/export-scripts
 * Export migration SQL scripts for DBA to execute manually.
 * Returns actual SQL content that can be copied and executed.
 * 
 * Query params:
 * - pending: if "true", only return pending migrations
 * - format: "combined" for single script, "individual" for separate scripts (default)
 */
schemaValidationRouter.get('/export-scripts', async (req: Request, res: Response) => {
  try {
    const pendingOnly = req.query.pending === 'true';
    const format = req.query.format === 'combined' ? 'combined' : 'individual';

    let executedIds = new Set<string>();
    let dbConnected = false;

    // Try to get executed migrations from DB
    if (isSharedDbConnected()) {
      try {
        const pool = getSharedPool();
        const executed = await getExecutedMigrations(pool);
        executedIds = new Set(executed);
        dbConnected = true;
      } catch {
        // DB error, assume nothing executed
      }
    }

    // Filter migrations based on pending flag
    const migrations = pendingOnly 
      ? MIGRATION_SQLS.filter(m => !executedIds.has(m.id))
      : MIGRATION_SQLS;

    // Build response based on format
    if (format === 'combined') {
      const combinedSQL = pendingOnly
        ? SCHEMA_SETUP_SQL + '\n\n' + migrations.map(m => m.sql).join('\n\n')
        : getAllMigrationSQL();

      return res.json({
        success: true,
        format: 'combined',
        dbConnected,
        pendingCount: migrations.length,
        totalCount: MIGRATION_SQLS.length,
        schemaSetup: SCHEMA_SETUP_SQL.trim(),
        sql: combinedSQL,
        instructions: [
          '1. Review the SQL script below',
          '2. Connect to your PostgreSQL database as a user with CREATE privileges',
          '3. Execute the script in a transaction for safety',
          '4. Each migration records itself in workspace_app.migrations table'
        ]
      });
    }

    // Individual format - return each migration separately
    const migrationScripts = migrations.map(m => ({
      id: m.id,
      description: m.description,
      status: executedIds.has(m.id) ? 'executed' : 'pending',
      sql: m.sql.trim()
    }));

    return res.json({
      success: true,
      format: 'individual',
      dbConnected,
      pendingCount: migrations.filter(m => !executedIds.has(m.id)).length,
      totalCount: MIGRATION_SQLS.length,
      schemaSetup: SCHEMA_SETUP_SQL.trim(),
      migrations: migrationScripts,
      instructions: [
        '1. First run the schemaSetup SQL to create the schema and migrations table',
        '2. Execute each pending migration in order (by ID number)',
        '3. Each migration script includes its own INSERT into migrations table',
        '4. Never skip migrations or run them out of order'
      ]
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export scripts';
    return res.status(500).json({
      success: false,
      message
    });
  }
});
