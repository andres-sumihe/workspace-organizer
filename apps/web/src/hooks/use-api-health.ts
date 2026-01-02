import { useState, useEffect, useCallback } from 'react';

interface ApiHealthState {
  isConnected: boolean;
  isChecking: boolean;
  error: string | null;
  retryCount: number;
}

// Determine if running in Electron production mode
const isElectronProduction = () => {
  return typeof window !== 'undefined' && 
         window.location.protocol === 'app:';
};

// Get the health check URL based on environment
const getHealthUrl = () => {
  if (isElectronProduction()) {
    // In Electron production, use relative URL (will be handled by custom protocol)
    return '/api/health';
  }
  // In development, use absolute URL to port 4000
  const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:4000';
  return `${baseUrl}/api/health`;
};

const MAX_RETRIES = 10;
const RETRY_INTERVAL = 2000;

export function useApiHealth() {
  const [state, setState] = useState<ApiHealthState>({
    isConnected: false,
    isChecking: true,
    error: null,
    retryCount: 0,
  });

  const checkHealth = useCallback(async () => {
    try {
      const healthUrl = getHealthUrl();
      const response = await fetch(healthUrl, {
        method: 'GET',
        cache: 'no-store',
      });

      if (response.ok) {
        setState({
          isConnected: true,
          isChecking: false,
          error: null,
          retryCount: 0,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const retryConnection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isChecking: true,
      retryCount: 0,
      error: null,
    }));
  }, []);

  useEffect(() => {
    if (!state.isChecking || state.isConnected) return;

    const attemptConnection = async () => {
      const success = await checkHealth();

      if (!success) {
        setState((prev) => {
          const newRetryCount = prev.retryCount + 1;
          
          if (newRetryCount >= MAX_RETRIES) {
            return {
              ...prev,
              isChecking: false,
              error: 'Unable to connect to the API server. Please ensure the server is running.',
              retryCount: newRetryCount,
            };
          }

          return {
            ...prev,
            retryCount: newRetryCount,
          };
        });
      }
    };

    attemptConnection();

    // Set up retry interval
    if (state.retryCount < MAX_RETRIES && !state.isConnected) {
      const timer = setTimeout(attemptConnection, RETRY_INTERVAL);
      return () => clearTimeout(timer);
    }
  }, [state.isChecking, state.isConnected, state.retryCount, checkHealth]);

  return {
    ...state,
    retryConnection,
  };
}
