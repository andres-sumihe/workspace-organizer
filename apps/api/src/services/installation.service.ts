import { Pool } from 'pg';

import {
  initializeSharedDb,
  testConnection,
  buildConnectionString,
  getSharedPool,
  isSharedDbConnected
} from '../db/shared-client.js';
import { runSharedMigrations, getAllMigrationIds, getExecutedMigrations } from '../db/shared-migrations/index.js';
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
 * IMPORTANT: This service does NOT create users - authentication is always local (SQLite).
 * It only configures the PostgreSQL connection for shared team DATA (scripts, jobs, etc.).
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
   * Get current installation status
   */
  async getStatus(): Promise<InstallationStatus> {
    const isConfigured = await this.isConfigured();

    let sharedDbConnected = false;
    let adminUserCreated = false; // No longer relevant - auth is local
    let migrationsRun = false;
    let pendingMigrations: string[] = [];

    // Check if shared DB is connected
    if (isSharedDbConnected()) {
      sharedDbConnected = true;

      try {
        const pool = getSharedPool();
        const allMigrations = getAllMigrationIds();
        const executedMigrations = await getExecutedMigrations(pool);

        migrationsRun = executedMigrations.length > 0;
        pendingMigrations = allMigrations.filter((id) => !executedMigrations.includes(id));
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
      pendingMigrations
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
   * - Store connection string
   * - Initialize shared database
   * - Run migrations
   * 
   * NOTE: This no longer creates users - authentication is local only.
   * The adminUser field in the request is ignored.
   */
  async configure(request: ConfigureInstallationRequest): Promise<ConfigureInstallationResponse> {
    const { database } = request;

    // Build and store connection string
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

    // Store connection string in local settings
    await settingsRepository.set('shared_db_connection', connectionString);

    // Initialize the shared database connection
    await initializeSharedDb(connectionString);

    // Run migrations
    const pool = getSharedPool();
    const migrationsRun = await runSharedMigrations(pool);

    // Enable shared mode
    const { modeService } = await import('./mode.service.js');
    await modeService.enableSharedMode();

    // Mark installation as complete
    await settingsRepository.set('installation_completed', true);

    return {
      success: true,
      message: 'Shared database configured successfully',
      migrationsRun,
      adminUserId: undefined // No longer created - auth is local
    };
  },

  /**
   * Initialize shared database connection on app startup
   * Connects if connection string is configured (regardless of installation status)
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
      
      // Run pending migrations on startup
      const pool = getSharedPool();
      await runSharedMigrations(pool);
      
      const { modeService } = await import('./mode.service.js');
      await modeService.enableSharedMode();
      return true;
    } catch (error) {
      dbLogger.error({ err: error }, 'Failed to initialize shared database');
      return false;
    }
  }
};
