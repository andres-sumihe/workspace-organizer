import { Pool } from 'pg';

import { authService } from './auth.service.js';
import {
  initializeSharedDb,
  testConnection,
  buildConnectionString,
  getSharedPool,
  isSharedDbConnected
} from '../db/shared-client.js';
import { runSharedMigrations, getAllMigrationIds, getExecutedMigrations } from '../db/shared-migrations/index.js';
import { settingsRepository } from '../repositories/settings.repository.js';

import type {
  ConfigureInstallationRequest,
  ConfigureInstallationResponse,
  InstallationStatus,
  TestConnectionRequest,
  TestConnectionResponse
} from '@workspace/shared';

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
    let adminUserCreated = false;
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

    // Check if admin user exists
    const adminUserIdSetting = await settingsRepository.get<string>('admin_user_id');
    adminUserCreated = !!adminUserIdSetting?.value;

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
   * - Create admin user
   */
  async configure(request: ConfigureInstallationRequest): Promise<ConfigureInstallationResponse> {
    const { database, adminUser } = request;

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

    // Validate admin user data
    const validation = authService.validatePassword(adminUser.password);
    if (!validation.valid) {
      throw new Error(`Password validation failed: ${validation.errors.join('. ')}`);
    }

    // Get admin role
    const adminRole = await authService.getRoleByName('admin');
    if (!adminRole) {
      throw new Error('Admin role not found. Migrations may have failed.');
    }

    // Create admin user
    const user = await authService.createUser({
      username: adminUser.username,
      email: adminUser.email,
      password: adminUser.password,
      displayName: adminUser.displayName,
      roleIds: [adminRole.id]
    });

    // Store admin user ID and mark installation as complete
    await settingsRepository.set('admin_user_id', user.id);
    await settingsRepository.set('installation_completed', true);

    return {
      success: true,
      message: 'Installation completed successfully',
      migrationsRun,
      adminUserId: user.id
    };
  },

  /**
   * Initialize shared database connection on app startup
   * Only if already configured
   */
  async initializeOnStartup(): Promise<boolean> {
    const isConfigured = await this.isConfigured();

    if (!isConfigured) {
      return false;
    }

    try {
      await initializeSharedDb();
      return true;
    } catch (error) {
      console.error('Failed to initialize shared database:', error);
      return false;
    }
  }
};
