import { createContext, useContext, useEffect, useState, useCallback } from 'react';

import type { LoginRequest, Permission, UserWithRoles } from '@workspace/shared';
import type { ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

interface AuthState {
  user: UserWithRoles | null;
  permissions: Permission[];
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Token storage keys
const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    permissions: [],
    isAuthenticated: false,
    isLoading: true,
  });

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
        setState({
          user: data.user,
          permissions: data.permissions || [],
          isAuthenticated: true,
          isLoading: false,
        });
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
              setState({
                user: data.user,
                permissions: data.permissions || [],
                isAuthenticated: true,
                isLoading: false,
              });
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

    setState({
      user: data.user,
      permissions: data.user.permissions || [],
      isAuthenticated: true,
      isLoading: false,
    });
  };

  // Logout
  const logout = async (): Promise<void> => {
    const token = getAccessToken();

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
      });
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      const success = await fetchCurrentUser();
      if (!success) {
        clearTokens();
        setState({
          user: null,
          permissions: [],
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    initAuth();
  }, [fetchCurrentUser]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        refreshAuth,
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
  return permissions.some((p) => p.resource === resource && p.action === action);
}
