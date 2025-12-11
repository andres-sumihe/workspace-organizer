import { localAuthProvider } from './local-auth.provider.js';
import { authService } from '../services/auth.service.js';
import { modeService } from '../services/mode.service.js';

import type { LoginRequest, LoginResponse, AuthenticatedUser } from '@workspace/shared';

/**
 * Mode-Aware Auth Provider
 * 
 * Delegates authentication operations to either local or shared providers
 * based on the current application mode.
 * 
 * - Solo Mode: Uses localAuthProvider (SQLite)
 * - Shared Mode: Uses authService (PostgreSQL)
 */

export const modeAwareAuthProvider = {
  /**
   * Login with mode-aware delegation
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    const mode = await modeService.getMode();
    
    if (mode === 'shared') {
      return authService.login(request);
    }
    
    return localAuthProvider.login(request);
  },

  /**
   * Get user by ID with roles and permissions
   */
  async getUserById(id: string): Promise<AuthenticatedUser | null> {
    const mode = await modeService.getMode();
    
    if (mode === 'shared') {
      const user = await authService.getUserById(id);
      if (!user) return null;

      const roles = await authService.getUserRoles(id);
      const permissions = await authService.getUserPermissions(id);

      return {
        ...user,
        mode: 'shared',
        roles: roles.map(r => r.name),
        permissions: permissions.map(p => `${p.resource}:${p.action}`)
      };
    }

    // Solo mode
    const user = await localAuthProvider.getUserById(id);
    if (!user) return null;

    return {
      ...user,
      mode: 'solo',
      roles: [],
      permissions: []
    };
  },

  /**
   * Verify JWT token (tries both providers)
   */
  async verifyToken(token: string): Promise<{ userId: string; mode: 'solo' | 'shared' }> {
    // Try local auth first (faster, no network)
    try {
      const localDecoded = await localAuthProvider.verifyToken(token);
      if (localDecoded?.mode === 'solo') {
        return { userId: localDecoded.userId, mode: 'solo' };
      }
    } catch {
      // Not a local token, try shared
    }

    // Try shared auth
    try {
      const sharedDecoded = await authService.verifyToken(token);
      return { userId: sharedDecoded.userId, mode: 'shared' };
    } catch {
      throw new Error('INVALID_TOKEN');
    }
  },

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string, mode: 'solo' | 'shared'): Promise<LoginResponse> {
    if (mode === 'shared') {
      // Shared mode returns partial response, need to get user
      const tokenResult = await authService.refreshToken(refreshToken);
      const decoded = await authService.verifyToken(tokenResult.accessToken);
      const user = await this.getUserById(decoded.userId);
      
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      return {
        accessToken: tokenResult.accessToken,
        refreshToken,
        expiresIn: tokenResult.expiresIn,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          isActive: user.isActive,
          roles: user.roles.map(r => ({ id: '', name: r, description: undefined, isSystem: false, createdAt: '', updatedAt: '' })),
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      };
    }
    
    return localAuthProvider.refreshToken(refreshToken);
  },

  /**
   * Check if user has permission
   * In Solo mode, always returns true (no RBAC)
   * In Shared mode, checks actual permissions
   */
  async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const mode = await modeService.getMode();
    
    if (mode === 'solo') {
      return true; // No RBAC in Solo mode
    }
    
    return authService.hasPermission(userId, resource, action);
  },

  /**
   * Logout
   */
  async logout(refreshToken: string, mode: 'solo' | 'shared'): Promise<void> {
    if (mode === 'shared') {
      return authService.logout(refreshToken);
    }
    
    return localAuthProvider.logout(refreshToken);
  }
};
