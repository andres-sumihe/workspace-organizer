import { modeService } from './mode.service.js';
import { localAuthProvider } from '../auth/local-auth.provider.js';
import { isSharedDbConnected } from '../db/shared-client.js';

import type { SetupStatus, CreateAccountRequest, LocalUser } from '@workspace/shared';

/**
 * Setup Service
 * 
 * Handles first-time application setup in Solo mode.
 * Checks if local user exists and creates the first account.
 */

export const setupService = {
  /**
   * Get setup status
   * Returns whether the app needs initial setup (no local user exists)
   */
  async getStatus(): Promise<SetupStatus> {
    const hasLocalUser = await modeService.hasLocalUser();
    const sharedEnabled = await modeService.isSharedEnabled();
    const sharedDbConnected = await isSharedDbConnected();

    return {
      needsSetup: !hasLocalUser,
      hasSharedDb: sharedDbConnected,
      sharedDbConnected,
      sharedEnabled
    };
  },

  /**
   * Create the first local user account
   * This is called during first-time setup
   */
  async createAccount(request: CreateAccountRequest): Promise<LocalUser> {
    // Check if setup is still needed
    const hasLocalUser = await modeService.hasLocalUser();
    if (hasLocalUser) {
      throw new Error('SETUP_ALREADY_COMPLETE');
    }

    // Validate request
    if (!request.username || request.username.length < 3) {
      throw new Error('INVALID_USERNAME');
    }

    if (!request.email || !request.email.includes('@')) {
      throw new Error('INVALID_EMAIL');
    }

    if (!request.password || request.password.length < 8) {
      throw new Error('WEAK_PASSWORD');
    }

    // Create the first local user
    const user = await localAuthProvider.createUser(request);

    return user;
  },

  /**
   * Check if setup has been completed
   */
  async isSetupComplete(): Promise<boolean> {
    return await modeService.hasLocalUser();
  }
};
