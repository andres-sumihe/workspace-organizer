import { getDb } from '../db/client.js';
import { ensureSharedDbConnection, isSharedDbConnected } from '../db/shared-client.js';
import { settingsRepository } from '../repositories/settings.repository.js';
import { authLogger } from '../utils/logger.js';

import type { AppMode, ModeStatus, ModeConfig } from '@workspace/shared';

/**
 * Mode Service
 * 
 * Manages the application mode (Solo vs Shared) and provides utilities for
 * mode detection and switching.
 * 
 * - Solo Mode: Local SQLite authentication, no RBAC, offline-capable
 * - Shared Mode: PostgreSQL authentication, full RBAC, team features
 */

export const modeService = {
  /**
   * Get the current application mode
   * Returns 'shared' if shared_enabled is true, otherwise 'solo'
   */
  async getMode(): Promise<AppMode> {
    const setting = await settingsRepository.get<boolean>('shared_enabled');
    if (setting?.value !== true) {
      return 'solo';
    }

    const connected = await ensureSharedDbConnection();
    return connected ? 'shared' : 'solo';
  },

  /**
   * Check if shared mode is enabled
   */
  async isSharedEnabled(): Promise<boolean> {
    const setting = await settingsRepository.get<boolean>('shared_enabled');
    return setting?.value === true;
  },

  /**
   * Get comprehensive mode status including connectivity
   */
  async getStatus(): Promise<ModeStatus> {
    const sharedEnabled = await this.isSharedEnabled();
    let sharedDbConnected = await isSharedDbConnected();

    if (sharedEnabled && !sharedDbConnected) {
      sharedDbConnected = await ensureSharedDbConnection();
    }

    const mode: AppMode = sharedEnabled && sharedDbConnected ? 'shared' : 'solo';

    return {
      mode,
      sharedEnabled,
      sharedDbConnected
    };
  },

  /**
   * Get full mode configuration including local user status
   */
  async getConfig(): Promise<ModeConfig> {
    const status = await this.getStatus();
    const localUserExists = await this.hasLocalUser();

    return {
      ...status,
      localUserExists
    };
  },

  /**
   * Enable shared/team mode
   */
  async enableSharedMode(): Promise<void> {
    await settingsRepository.set('shared_enabled', true, 'Enable shared/team mode');
  },

  /**
   * Disable shared/team mode (return to Solo)
   */
  async disableSharedMode(): Promise<void> {
    await settingsRepository.set('shared_enabled', false, 'Disable shared/team mode');
  },

  /**
   * Check if any local user exists (for first-time setup detection)
   */
  async hasLocalUser(): Promise<boolean> {
    try {
      const db = await getDb();
      const row = db.prepare('SELECT COUNT(*) as count FROM local_users').get();
      return (row as { count: number })?.count > 0;
    } catch (error) {
      // Table might not exist yet if migrations haven't completed
      authLogger.error({ err: error }, 'Error checking local users');
      return false;
    }
  }
};
