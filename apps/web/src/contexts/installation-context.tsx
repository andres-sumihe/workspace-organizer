import { createContext, useContext, useEffect, useState, useCallback } from 'react';

import type { InstallationStatus } from '@workspace/shared';
import type { ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

interface InstallationContextValue {
  status: InstallationStatus | null;
  isLoading: boolean;
  error: string | null;
  checkStatus: () => Promise<InstallationStatus | null>;
  isConfigured: boolean;
  needsInstallation: boolean;
}

const InstallationContext = createContext<InstallationContextValue | null>(null);

export function InstallationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<InstallationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async (): Promise<InstallationStatus | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/v1/installation/status`);
      if (!response.ok) {
        throw new Error('Failed to check installation status');
      }

      const data: InstallationStatus = await response.json();
      setStatus(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check installation status';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const isConfigured = status?.isConfigured ?? false;
  const needsInstallation = !isConfigured || !status?.adminUserCreated;

  return (
    <InstallationContext.Provider
      value={{
        status,
        isLoading,
        error,
        checkStatus,
        isConfigured,
        needsInstallation,
      }}
    >
      {children}
    </InstallationContext.Provider>
  );
}

export function useInstallation() {
  const context = useContext(InstallationContext);
  if (!context) {
    throw new Error('useInstallation must be used within an InstallationProvider');
  }
  return context;
}
