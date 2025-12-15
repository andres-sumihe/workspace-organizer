import { Router } from 'express';

import { schemaValidationService } from '../../services/schema-validation.service.js';
import { runSharedMigrations } from '../../db/shared-migrations/index.js';
import { getSharedPool } from '../../db/shared-client.js';

import type { Request, Response } from 'express';

const schemaValidationRouter = Router();

/**
 * GET /api/v1/schema-validation/validate
 * Validate all shared database tables against expected schemas
 */
schemaValidationRouter.get('/validate', async (_req: Request, res: Response) => {
  try {
    const validationResult = await schemaValidationService.validateAllTables();
    res.json(validationResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Schema validation failed';
    res.status(500).json({
      success: false,
      message,
      valid: false,
      tables: {},
      summary: { total: 0, valid: 0, invalid: 0, missing: 0 }
    });
  }
});

/**
 * POST /api/v1/schema-validation/reset-and-migrate
 * WARNING: Destructive operation!
 * Drops all tables in the shared schema and re-runs all migrations from scratch
 */
schemaValidationRouter.post('/reset-and-migrate', async (_req: Request, res: Response) => {
  try {
    // Step 1: Reset database (drop all tables)
    const resetResult = await schemaValidationService.resetDatabase();

    // Step 2: Re-run all migrations
    const pool = getSharedPool();
    const migrationsRun = await runSharedMigrations(pool);

    // Step 3: Validate the new schema
    const validationResult = await schemaValidationService.validateAllTables();

    res.json({
      success: true,
      reset: resetResult,
      migrations: {
        count: migrationsRun.length,
        executed: migrationsRun
      },
      validation: validationResult
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reset and migrate failed';
    res.status(500).json({
      success: false,
      message
    });
  }
});

export default schemaValidationRouter;
