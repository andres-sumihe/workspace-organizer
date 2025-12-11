import { installationService } from './installation.service.js';
import { migrationService } from './migration.service.js';
import { modeService } from './mode.service.js';

import type { TeamConfigStatus, TestConnectionRequest } from '@workspace/shared';

/**
 * Team Configuration Service
 * 
 * Manages the configuration of team/shared features.
 * Wraps installation service for configuring PostgreSQL and enabling shared mode.
 */

export const teamConfigService = {
  /**
   * Get team configuration status
   */
  async getStatus(): Promise<TeamConfigStatus> {
    const installStatus = await installationService.getStatus();
    const migrationStatus = await migrationService.getStatus();

    return {
      isConfigured: installStatus.isConfigured,
      connectionString: installStatus.isConfigured ? '[configured]' : undefined,
      lastTestSuccessful: installStatus.sharedDbConnected,
      pendingMigration: migrationStatus.scriptsCount > 0 || migrationStatus.jobsCount > 0
    };
  },

  /**
   * Test PostgreSQL connection
   */
  async testConnection(request: TestConnectionRequest) {
    return installationService.testConnection(request);
  },

  /**
   * Configure team features (PostgreSQL + admin user)
   */
  async configure(request: {
    database: TestConnectionRequest;
    adminUser: {
      username: string;
      email: string;
      password: string;
      displayName?: string;
    };
  }) {
    // Use installation service to configure
    const result = await installationService.configure(request);

    if (result.success) {
      // Enable shared mode
      await modeService.enableSharedMode();
    }

    return result;
  },

  /**
   * Disable team features (return to Solo mode)
   */
  async disable(): Promise<{ success: boolean; message: string }> {
    try {
      await modeService.disableSharedMode();
      return {
        success: true,
        message: 'Team features disabled. App is now in Solo mode.'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to disable team features'
      };
    }
  },

  /**
   * Get migration status
   */
  async getMigrationStatus() {
    return migrationService.getStatus();
  },

  /**
   * Migrate local data to shared database
   */
  async migrateData(options: { dryRun?: boolean } = {}) {
    return migrationService.migrateScripts(options);
  }
};
