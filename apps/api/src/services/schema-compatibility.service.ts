/**
 * Schema Compatibility Service
 *
 * Validates PostgreSQL schema compatibility without modifying the database.
 * Users cannot run migrations - they must provide a pre-configured database
 * with the correct schema version.
 *
 * WORKFLOW:
 * 1. User connects to PostgreSQL database
 * 2. App checks if schema exists and validates version
 * 3. If compatible: allow connection
 * 4. If not compatible: show error and provide DBA scripts
 * 5. DBA runs provided scripts manually
 * 6. User retries connection
 */

import { SHARED_SCHEMA, SCHEMA_VERSION, MIN_SCHEMA_VERSION } from '../db/shared-schema.js';
import { schemaValidationService } from './schema-validation.service.js';

import type { Pool } from 'pg';

export interface SchemaCompatibilityResult {
  /**
   * Whether the schema is compatible with this app version
   */
  compatible: boolean;

  /**
   * Whether the schema exists at all
   */
  schemaExists: boolean;

  /**
   * Current schema version in the database (null if not found)
   */
  currentVersion: number | null;

  /**
   * Schema version required by this app
   */
  requiredVersion: number;

  /**
   * Minimum schema version this app can work with
   */
  minVersion: number;

  /**
   * Human-readable status message
   */
  message: string;

  /**
   * Action required by user/DBA
   */
  action: 'none' | 'create_schema' | 'upgrade_schema' | 'downgrade_app';

  /**
   * Detailed table validation results (when schema exists)
   */
  tableValidation?: {
    valid: boolean;
    summary: {
      total: number;
      valid: number;
      invalid: number;
      missing: number;
    };
  };
}

export const schemaCompatibilityService = {
  /**
   * Check if the workspace_organizer schema exists
   */
  async schemaExists(pool: Pool): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.schemata
        WHERE schema_name = $1
      ) as exists`,
      [SHARED_SCHEMA]
    );
    return result.rows[0]?.exists ?? false;
  },

  /**
   * Check if schema_info table exists
   */
  async schemaInfoTableExists(pool: Pool): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = 'schema_info'
      ) as exists`,
      [SHARED_SCHEMA]
    );
    return result.rows[0]?.exists ?? false;
  },

  /**
   * Get current schema version from database
   * Returns null if schema_info table doesn't exist or no version record
   */
  async getSchemaVersion(pool: Pool): Promise<number | null> {
    try {
      // Check if schema_info table exists first
      const tableExists = await this.schemaInfoTableExists(pool);
      if (!tableExists) {
        // Legacy schema without version tracking - assume v1 if migrations table exists
        const migrationsExists = await pool.query<{ exists: boolean }>(
          `SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = 'migrations'
          ) as exists`,
          [SHARED_SCHEMA]
        );

        if (migrationsExists.rows[0]?.exists) {
          // Legacy schema with migrations - treat as v1
          return 1;
        }
        return null;
      }

      const result = await pool.query<{ version: number }>(
        `SELECT version FROM ${SHARED_SCHEMA}.schema_info ORDER BY updated_at DESC LIMIT 1`
      );

      return result.rows[0]?.version ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Main compatibility check - validates schema before allowing connection
   */
  async checkCompatibility(pool: Pool): Promise<SchemaCompatibilityResult> {
    const requiredVersion = SCHEMA_VERSION;
    const minVersion = MIN_SCHEMA_VERSION;

    // Check if schema exists
    const schemaExists = await this.schemaExists(pool);

    if (!schemaExists) {
      return {
        compatible: false,
        schemaExists: false,
        currentVersion: null,
        requiredVersion,
        minVersion,
        message:
          'Database schema does not exist. Please ask your DBA to create the schema using the provided SQL script.',
        action: 'create_schema'
      };
    }

    // Get current version
    const currentVersion = await this.getSchemaVersion(pool);

    if (currentVersion === null) {
      return {
        compatible: false,
        schemaExists: true,
        currentVersion: null,
        requiredVersion,
        minVersion,
        message:
          'Schema exists but version information is missing. Please ask your DBA to run the schema upgrade script.',
        action: 'upgrade_schema'
      };
    }

    // Check version compatibility
    if (currentVersion < minVersion) {
      return {
        compatible: false,
        schemaExists: true,
        currentVersion,
        requiredVersion,
        minVersion,
        message: `Schema version ${currentVersion} is too old. Minimum required: ${minVersion}. Please ask your DBA to upgrade the schema.`,
        action: 'upgrade_schema'
      };
    }

    if (currentVersion > requiredVersion) {
      return {
        compatible: false,
        schemaExists: true,
        currentVersion,
        requiredVersion,
        minVersion,
        message: `Schema version ${currentVersion} is newer than this app supports (${requiredVersion}). Please upgrade the application.`,
        action: 'downgrade_app'
      };
    }

    // Version is compatible - validate table structure
    const tableValidation = await schemaValidationService.validateAllTables();

    if (!tableValidation.valid) {
      return {
        compatible: false,
        schemaExists: true,
        currentVersion,
        requiredVersion,
        minVersion,
        message: `Schema version is compatible but table structure is incomplete. Missing: ${tableValidation.summary.missing} tables, Invalid: ${tableValidation.summary.invalid} tables. Please ask your DBA to verify the schema.`,
        action: 'upgrade_schema',
        tableValidation: {
          valid: tableValidation.valid,
          summary: tableValidation.summary
        }
      };
    }

    // All checks passed
    return {
      compatible: true,
      schemaExists: true,
      currentVersion,
      requiredVersion,
      minVersion,
      message: 'Schema is compatible',
      action: 'none',
      tableValidation: {
        valid: tableValidation.valid,
        summary: tableValidation.summary
      }
    };
  },

  /**
   * Quick check if schema is ready (used for status endpoints)
   */
  async isSchemaReady(pool: Pool): Promise<boolean> {
    const result = await this.checkCompatibility(pool);
    return result.compatible;
  }
};
