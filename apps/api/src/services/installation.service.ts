import { Pool } from 'pg';

import {
  initializeSharedDb,
  testConnection,
  buildConnectionString,
  getSharedPool,
  isSharedDbConnected
} from '../db/shared-client.js';
import { SCHEMA_VERSION, MIN_SCHEMA_VERSION } from '../db/shared-schema.js';
import { schemaCompatibilityService } from './schema-compatibility.service.js';
import { settingsRepository } from '../repositories/settings.repository.js';
import { dbLogger } from '../utils/logger.js';

import type {
  ConfigureInstallationRequest,
  ConfigureInstallationResponse,
  InstallationStatus,
  TestConnectionRequest,
  TestConnectionResponse
} from '@workspace/shared';

/**
 * Installation Service
 *
 * Manages the configuration of the shared PostgreSQL database connection.
 *
 * IMPORTANT CHANGES (Schema-Versioned System):
 * - Users CANNOT run migrations - only DBAs can modify schema
 * - App validates schema compatibility before allowing connection
 * - If schema is incompatible, user must ask DBA to run provided SQL scripts
 * - This ensures enterprise-grade control over database changes
 */

export const installationService = {
  /**
   * Check if the application has been installed/configured
   */
  async isConfigured(): Promise<boolean> {
    const setting = await settingsRepository.get<boolean>('installation_completed');
    return setting?.value === true;
  },

  /**
   * Get current installation status with schema compatibility info
   */
  async getStatus(): Promise<InstallationStatus> {
    const isConfigured = await this.isConfigured();

    let sharedDbConnected = false;
    let adminUserCreated = false;
    let migrationsRun = false;
    let pendingMigrations: string[] = [];
    let schemaCompatible = false;
    let schemaVersion: number | null = null;

    // Check if shared DB is connected
    if (isSharedDbConnected()) {
      sharedDbConnected = true;

      try {
        const pool = getSharedPool();
        const compatibility = await schemaCompatibilityService.checkCompatibility(pool);

        schemaCompatible = compatibility.compatible;
        schemaVersion = compatibility.currentVersion;
        migrationsRun = compatibility.schemaExists;

        // For backward compatibility, report as no pending migrations if compatible
        if (!compatibility.compatible && compatibility.action !== 'none') {
          pendingMigrations = ['schema-upgrade-required'];
        }
      } catch {
        // Database might not be fully set up yet
      }
    }

    // Admin user is now local - check if local user exists
    const localUserSetting = await settingsRepository.get<string>('local_user_exists');
    adminUserCreated = localUserSetting?.value === 'true';

    return {
      isConfigured,
      sharedDbConnected,
      adminUserCreated,
      migrationsRun,
      pendingMigrations,
      schemaVersion: schemaVersion ?? undefined,
      schemaCompatible,
      requiredSchemaVersion: SCHEMA_VERSION,
      minSchemaVersion: MIN_SCHEMA_VERSION
    };
  },

  /**
   * Test a PostgreSQL connection
   */
  async testConnection(config: TestConnectionRequest): Promise<TestConnectionResponse> {
    const connectionString = buildConnectionString({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl
    });

    try {
      await testConnection(connectionString);

      // Get PostgreSQL version
      const pool = new Pool({
        connectionString,
        max: 1,
        connectionTimeoutMillis: 5000
      });

      try {
        const result = await pool.query('SELECT version()');
        const version = result.rows[0]?.version || 'Unknown';

        return {
          success: true,
          message: 'Connection successful',
          version
        };
      } finally {
        await pool.end();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      return {
        success: false,
        message: `Connection failed: ${message}`
      };
    }
  },

  /**
   * Configure the installation
   * - Test connection
   * - Validate schema compatibility
   * - Store connection string (only if schema is compatible)
   *
   * NOTE: This no longer runs migrations - users cannot modify schema.
   * If schema is incompatible, configuration will fail with instructions.
   */
  async configure(request: ConfigureInstallationRequest): Promise<ConfigureInstallationResponse> {
    const { database } = request;

    // Build connection string
    const connectionString = buildConnectionString({
      host: database.host,
      port: database.port,
      database: database.database,
      user: database.user,
      password: database.password,
      ssl: database.ssl
    });

    // Test connection first
    const testResult = await this.testConnection(database);
    if (!testResult.success) {
      throw new Error(testResult.message);
    }

    // Create temporary pool for schema validation
    const tempPool = new Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 5000
    });

    try {
      // Validate schema compatibility BEFORE storing connection
      const compatibility = await schemaCompatibilityService.checkCompatibility(tempPool);

      if (!compatibility.compatible) {
        // Do NOT store connection - schema is not ready
        throw new Error(
          `Schema validation failed: ${compatibility.message}. ` +
            `Please ask your DBA to run the schema creation script.`
        );
      }

      // Schema is compatible - now store connection string
      await settingsRepository.set('shared_db_connection', connectionString);

      // Initialize the shared database connection
      await initializeSharedDb(connectionString);

      // Enable shared mode
      const { modeService } = await import('./mode.service.js');
      await modeService.enableSharedMode();

      // Mark installation as complete
      await settingsRepository.set('installation_completed', true);

      return {
        success: true,
        message: 'Shared database configured successfully',
        migrationsRun: [], // No migrations run - schema was pre-configured
        adminUserId: undefined,
        schemaVersion: compatibility.currentVersion ?? undefined
      };
    } finally {
      await tempPool.end();
    }
  },

  /**
   * Initialize shared database connection on app startup
   * Validates schema compatibility - does NOT run migrations
   */
  async initializeOnStartup(): Promise<boolean> {
    // Check if connection string exists
    const { getSharedDbConnectionString } = await import('../db/shared-client.js');
    const connString = await getSharedDbConnectionString();

    if (!connString) {
      return false;
    }

    try {
      await initializeSharedDb(connString);

      // Validate schema compatibility (no migrations)
      const pool = getSharedPool();
      const compatibility = await schemaCompatibilityService.checkCompatibility(pool);

      if (!compatibility.compatible) {
        dbLogger.warn(
          { compatibility },
          'Shared database schema is incompatible - features may be limited'
        );
        // Still allow connection but log warning
      }

      const { modeService } = await import('./mode.service.js');
      await modeService.enableSharedMode();
      return true;
    } catch (error) {
      dbLogger.error({ err: error }, 'Failed to initialize shared database');
      return false;
    }
  }
};
