import { createContext, useContext, useEffect, useState, useCallback } from 'react';

import type { SetupStatus, ModeStatus, AppMode } from '@workspace/shared';
import type { ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

interface ModeContextValue {
  mode: AppMode;
  setupStatus: SetupStatus | null;
  modeStatus: ModeStatus | null;
  isLoading: boolean;
  error: string | null;
  needsSetup: boolean;
  isSharedMode: boolean;
  isSoloMode: boolean;
  checkSetupStatus: () => Promise<SetupStatus | null>;
  refreshMode: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [modeStatus] = useState<ModeStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkSetupStatus = useCallback(async (): Promise<SetupStatus | null> => {
    try {
      setError(null);

      const response = await fetch(`${API_URL}/api/v1/setup/status`);
      if (!response.ok) {
        throw new Error('Failed to check setup status');
      }

      const data: SetupStatus = await response.json();
      setSetupStatus(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check setup status';
      setError(message);
      return null;
    }
  }, []);

  const refreshMode = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await checkSetupStatus();
    } finally {
      setIsLoading(false);
    }
  }, [checkSetupStatus]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await checkSetupStatus();
      setIsLoading(false);
    };
    init();
  }, [checkSetupStatus]);

  // Derive mode from setup status
  const mode: AppMode = setupStatus?.sharedEnabled ? 'shared' : 'solo';
  const needsSetup = setupStatus?.needsSetup ?? true;
  const isSharedMode = mode === 'shared';
  const isSoloMode = mode === 'solo';

  return (
    <ModeContext.Provider
      value={{
        mode,
        setupStatus,
        modeStatus,
        isLoading,
        error,
        needsSetup,
        isSharedMode,
        isSoloMode,
        checkSetupStatus,
        refreshMode,
        refreshStatus: refreshMode,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
}

/**
 * Hook to check if the app is in Solo mode
 */
export function useIsSoloMode(): boolean {
  const { isSoloMode } = useMode();
  return isSoloMode;
}

/**
 * Hook to check if the app is in Shared mode
 */
export function useIsSharedMode(): boolean {
  const { isSharedMode } = useMode();
  return isSharedMode;
}
