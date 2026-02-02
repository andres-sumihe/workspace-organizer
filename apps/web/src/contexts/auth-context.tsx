import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';


import type { LoginRequest, Permission, UserWithRoles, AppMode, SessionConfig } from '@workspace/shared';
import type { ReactNode } from 'react';

import { onAuthError } from '@/api/client';

const API_URL = import.meta.env.VITE_API_URL || '';

interface AuthState {
  user: UserWithRoles | null;
  permissions: Permission[] | string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  mode: AppMode;
  /** Session is locked due to inactivity */
  isLocked: boolean;
  /** Session config from server */
  sessionConfig: SessionConfig | null;
}

interface AuthContextValue extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  refreshSessionConfig: () => Promise<void>;
  /** Unlock the session (re-authenticate after timeout) */
  unlock: (password: string) => Promise<void>;
  isSoloMode: boolean;
  isSharedMode: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Token storage keys
const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

// Default session config if not retrieved from server
const DEFAULT_SESSION_CONFIG: SessionConfig = {
  accessTokenExpiryMinutes: 15,
  refreshTokenExpiryDays: 7,
  inactivityTimeoutMinutes: 30,
  maxConcurrentSessions: 1,
  heartbeatIntervalSeconds: 60,
  enableSessionLock: true,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    permissions: [],
    isAuthenticated: false,
    isLoading: true,
    mode: 'solo',
    isLocked: false,
    sessionConfig: null,
  });

  // Refs for tracking activity
  const lastActivityRef = useRef<number>(Date.now());
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get stored tokens
  const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
  const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

  // Store tokens
  const setTokens = (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  };

  // Clear tokens
  const clearTokens = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  };

  // Record user activity
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Fetch session config from server
  const fetchSessionConfig = useCallback(async (): Promise<SessionConfig | null> => {
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/session-config`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to fetch session config:', error);
    }
    return null;
  }, []);

  // Send heartbeat to server (Solo mode only)
  const sendHeartbeat = useCallback(async () => {
    const token = getAccessToken();
    if (!token || state.mode !== 'solo') return;

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/heartbeat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        const data = await response.json();
        if (data.code === 'SESSION_EXPIRED') {
          // Session expired due to inactivity on server side
          setState((prev) => ({ ...prev, isLocked: true }));
        }
      }
    } catch (error) {
      console.warn('Heartbeat failed:', error);
    }
  }, [state.mode]);

  // Check for inactivity timeout on client side
  const checkInactivity = useCallback(() => {
    const config = state.sessionConfig || DEFAULT_SESSION_CONFIG;
    
    // Skip if lock is disabled
    if (config.enableSessionLock === false) return;

    const timeoutMs = config.inactivityTimeoutMinutes * 60 * 1000;
    const timeSinceActivity = Date.now() - lastActivityRef.current;

    if (timeSinceActivity > timeoutMs && state.isAuthenticated && !state.isLocked) {
      setState((prev) => ({ ...prev, isLocked: true }));
    }
  }, [state.sessionConfig, state.isAuthenticated, state.isLocked]);

  // Try to refresh the access token
  const tryRefreshToken = useCallback(async (): Promise<boolean> => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        setTokens(data.accessToken, data.refreshToken);
        return true;
      }

      // Refresh failed, clear tokens
      clearTokens();
      return false;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      clearTokens();
      return false;
    }
  }, []);

  // Fetch current user - note: we use a recursive approach for token refresh
  const fetchCurrentUser = useCallback(async (): Promise<boolean> => {
    const token = getAccessToken();
    if (!token) {
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setState((prev) => ({
          ...prev,
          user: data.user,
          permissions: data.permissions || [],
          isAuthenticated: true,
          isLoading: false,
          mode: data.mode || 'solo',
        }));
        return true;
      }

      // Token might be expired, try to refresh
      if (response.status === 401) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          // After refresh, we have new token, try to fetch again with fresh token
          const newToken = getAccessToken();
          if (newToken) {
            const retryResponse = await fetch(`${API_URL}/api/v1/auth/me`, {
              headers: {
                Authorization: `Bearer ${newToken}`,
              },
            });

            if (retryResponse.ok) {
              const data = await retryResponse.json();
              setState((prev) => ({
                ...prev,
                user: data.user,
                permissions: data.permissions || [],
                isAuthenticated: true,
                isLoading: false,
                mode: data.mode || 'solo',
              }));
              return true;
            }
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      return false;
    }
  }, [tryRefreshToken]);

  // Login
  const login = async (credentials: LoginRequest): Promise<void> => {
    const response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    setTokens(data.accessToken, data.refreshToken);

    // Reset activity timer
    lastActivityRef.current = Date.now();

    setState((prev) => ({
      ...prev,
      user: data.user,
      permissions: data.user.permissions || [],
      isAuthenticated: true,
      isLoading: false,
      mode: data.mode || 'solo',
      isLocked: false,
    }));
  };

  // Unlock (re-authenticate after inactivity timeout)
  const unlock = async (password: string): Promise<void> => {
    if (!state.user) {
      throw new Error('No user to unlock');
    }

    // Re-authenticate with stored username
    await login({
      username: state.user.username,
      password,
    });
  };

  // Logout
  const logout = async (): Promise<void> => {
    const token = getAccessToken();

    // Clear intervals
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (inactivityCheckRef.current) {
      clearInterval(inactivityCheckRef.current);
      inactivityCheckRef.current = null;
    }

    try {
      if (token) {
        await fetch(`${API_URL}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      clearTokens();
      setState({
        user: null,
        permissions: [],
        isAuthenticated: false,
        isLoading: false,
        mode: 'solo',
        isLocked: false,
        sessionConfig: null,
      });
    }
  };

  // Refresh auth state
  const refreshAuth = async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true }));
    const success = await fetchCurrentUser();
    if (!success) {
      clearTokens();
      setState({
        user: null,
        permissions: [],
        isAuthenticated: false,
        isLoading: false,
        mode: 'solo',
        isLocked: false,
        sessionConfig: null,
      });
    }
  };

  // Refresh session config
  const refreshSessionConfig = async (): Promise<void> => {
    const config = await fetchSessionConfig();
    if (config) {
      setState((prev) => ({ ...prev, sessionConfig: config }));
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      // Fetch session config first
      const config = await fetchSessionConfig();
      if (config) {
        setState((prev) => ({ ...prev, sessionConfig: config }));
      }

      const success = await fetchCurrentUser();
      if (!success) {
        clearTokens();
        setState({
          user: null,
          permissions: [],
          isAuthenticated: false,
          isLoading: false,
          mode: 'solo',
          isLocked: false,
          sessionConfig: config,
        });
      }
    };

    initAuth();
  }, [fetchCurrentUser, fetchSessionConfig]);

  // Listen for global auth errors from API client
  useEffect(() => {
    const unsubscribe = onAuthError((event) => {
      /**
       * Session Lock behavior:
       * 
       * When DISABLED (enableSessionLock === false):
       * - Session NEVER expires automatically
       * - User logs in once on app open, stays logged in indefinitely
       * - No auto-lock, no inactivity timeout
       * - Applies to ALL modes
       * 
       * When ENABLED:
       * - LOCK SCREEN (can unlock with password):
       *   - session_expired: User was idle too long, session timed out
       *   - User still exists and is valid, just needs to re-authenticate
       * 
       * FORCE LOGOUT (applies regardless of session lock setting):
       * - unauthorized: Token invalid, corrupted, or user doesn't exist
       * - User was deleted, deactivated, or token was tampered with
       */
      const config = state.sessionConfig || DEFAULT_SESSION_CONFIG;
      const sessionLockEnabled = config.enableSessionLock !== false;
      
      if (event.type === 'session_expired' && state.user && sessionLockEnabled) {
        // Session expired due to inactivity AND session lock is enabled - show lock screen
        // User can re-enter password to continue
        setState((prev) => ({ ...prev, isLocked: true }));
      } else if (event.type === 'session_expired' && !sessionLockEnabled) {
        // Session expired but lock is disabled - try to refresh silently
        // The access token was cleared, but refresh token is preserved
        tryRefreshToken().then((success) => {
          if (!success) {
            // Refresh failed - force logout
            clearTokens();
            setState((prev) => ({
              user: null,
              permissions: [],
              isAuthenticated: false,
              isLoading: false,
              mode: 'solo',
              isLocked: false,
              sessionConfig: prev.sessionConfig,
            }));
          }
          // If success, tokens are updated - next API call will work
        });
      } else {
        // Unauthorized, invalid token, or no user context
        // Force full logout - must go to login page
        clearTokens();
        setState((prev) => ({
          user: null,
          permissions: [],
          isAuthenticated: false,
          isLoading: false,
          mode: 'solo',
          isLocked: false,
          // Preserve sessionConfig since it's server-wide, not user-specific
          sessionConfig: prev.sessionConfig,
        }));
      }
    });

    return unsubscribe;
  }, [state.user, state.sessionConfig, tryRefreshToken]);

  // Setup heartbeat and inactivity check when authenticated
  // Only active when session lock is enabled
  useEffect(() => {
    const config = state.sessionConfig || DEFAULT_SESSION_CONFIG;
    const sessionLockEnabled = config.enableSessionLock !== false;
    
    // Skip all activity tracking if session lock is disabled
    // Session will stay active indefinitely once logged in
    if (!sessionLockEnabled) {
      return;
    }
    
    if (state.isAuthenticated && !state.isLocked && state.mode === 'solo') {

      // Setup heartbeat interval
      heartbeatIntervalRef.current = setInterval(
        sendHeartbeat,
        config.heartbeatIntervalSeconds * 1000
      );

      // Setup inactivity check (check every 10 seconds)
      inactivityCheckRef.current = setInterval(checkInactivity, 10000);

      // Setup activity listeners
      const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
      events.forEach((event) => {
        document.addEventListener(event, recordActivity, { passive: true });
      });

      return () => {
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        if (inactivityCheckRef.current) {
          clearInterval(inactivityCheckRef.current);
          inactivityCheckRef.current = null;
        }
        events.forEach((event) => {
          document.removeEventListener(event, recordActivity);
        });
      };
    }
  }, [
    state.isAuthenticated,
    state.isLocked,
    state.mode,
    state.sessionConfig,
    sendHeartbeat,
    checkInactivity,
    recordActivity,
  ]);

  const isSoloMode = state.mode === 'solo';
  const isSharedMode = state.mode === 'shared';

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        refreshAuth,
        refreshSessionConfig,
        unlock,
        isSoloMode,
        isSharedMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper to get the access token for API calls
export function getAuthToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

// Helper hook to check if user has a specific permission
export function useHasPermission(resource: string, action: string): boolean {
  const { permissions } = useAuth();
  return permissions.some((p) => {
    if (typeof p === 'string') {
      // Handle string format: "resource:action"
      return p === `${resource}:${action}`;
    }
    // Handle Permission object format
    return p.resource === resource && p.action === action;
  });
}
