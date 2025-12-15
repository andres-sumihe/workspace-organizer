import { localAuthProvider } from './local-auth.provider.js';
import { modeService } from '../services/mode.service.js';

import type { LoginRequest, LoginResponse, AuthenticatedUser, LoginContext } from '@workspace/shared';

/**
 * Auth Provider
 * 
 * Authentication ALWAYS uses local SQLite database regardless of mode.
 * Shared mode only affects data storage (scripts, jobs, etc.), NOT authentication.
 * 
 * This ensures users can always log in with their local credentials even when
 * shared mode is enabled or the shared database is unavailable.
 */

export const modeAwareAuthProvider = {
  /**
   * Login - always uses local auth
   */
  async login(request: LoginRequest, context?: LoginContext): Promise<LoginResponse> {
    return localAuthProvider.login(request, context);
  },

  /**
   * Get user by ID - always from local database
   * Mode is reported for UI to know which features are available
   */
  async getUserById(id: string): Promise<AuthenticatedUser | null> {
    const user = await localAuthProvider.getUserById(id);
    if (!user) return null;

    // Get mode for UI display purposes only
    const mode = await modeService.getMode();

    return {
      ...user,
      mode,
      roles: [],
      permissions: []
    };
  },

  /**
   * Verify JWT token - always local
   */
  async verifyToken(token: string): Promise<{ userId: string; mode: 'solo' | 'shared' }> {
    const decoded = await localAuthProvider.verifyToken(token);
    const mode = await modeService.getMode();
    return { userId: decoded.userId, mode };
  },

  /**
   * Refresh access token - always local
   */
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    return localAuthProvider.refreshToken(refreshToken);
  },

  /**
   * Check if user has permission
   * Currently always returns true (no RBAC implemented for local auth)
   */
  async hasPermission(_userId: string, _resource: string, _action: string): Promise<boolean> {
    return true;
  },

  /**
   * Logout - always local
   */
  async logout(refreshToken: string): Promise<void> {
    return localAuthProvider.logout(refreshToken);
  }
};
