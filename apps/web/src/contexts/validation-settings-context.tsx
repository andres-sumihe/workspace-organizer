import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

import { settingsApi } from '@/api/settings';
import type { ISO20022ValidationCriteria } from '@/utils/iso20022-validator';
import type { SwiftMTValidationCriteria } from '@/utils/swift-mt-validator';

interface ValidationSettingsContextValue {
  // Loading state
  isLoading: boolean;
  error: string | null;
  // ISO20022 (MX) settings
  criteria: ISO20022ValidationCriteria;
  updateCriteria: (criteria: ISO20022ValidationCriteria) => Promise<void>;
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => Promise<void>;
  // SWIFT MT settings
  mtCriteria: SwiftMTValidationCriteria;
  updateMTCriteria: (criteria: SwiftMTValidationCriteria) => Promise<void>;
  isMTEnabled: boolean;
  setIsMTEnabled: (enabled: boolean) => Promise<void>;
  // Refresh from server
  refresh: () => Promise<void>;
}

const ValidationSettingsContext = createContext<ValidationSettingsContextValue | undefined>(undefined);

const DEFAULT_CRITERIA: ISO20022ValidationCriteria = {
  senderDN: 'ou=xxx,o=cenaidja,o=swift',
  senderFullName: 'CENAIDJAXXX',
  receiverDN: 'ou=xxx,o=cenaidja,o=swift',
  receiverFullName: 'CENAIDJAXXX'
};

const DEFAULT_MT_CRITERIA: SwiftMTValidationCriteria = {
  senderBIC: '',
  receiverBIC: '',
  validateFormat: false,
  expectedFormat: undefined
};

export const ValidationSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ISO20022 state
  const [criteria, setCriteria] = useState<ISO20022ValidationCriteria>(DEFAULT_CRITERIA);
  const [isEnabled, setIsEnabledState] = useState(true);
  
  // SWIFT MT state
  const [mtCriteria, setMTCriteria] = useState<SwiftMTValidationCriteria>(DEFAULT_MT_CRITERIA);
  const [isMTEnabled, setIsMTEnabledState] = useState(false);

  // Load settings from API on mount
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const settings = await settingsApi.getValidationSettings();
      
      setCriteria(settings.iso20022.criteria);
      setIsEnabledState(settings.iso20022.enabled);
      setMTCriteria(settings.swiftMT.criteria);
      setIsMTEnabledState(settings.swiftMT.enabled);
    } catch (err) {
      console.error('Failed to load validation settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      // Keep default values on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Update ISO20022 criteria
  const updateCriteria = useCallback(async (newCriteria: ISO20022ValidationCriteria) => {
    try {
      const result = await settingsApi.updateISO20022Settings({ criteria: newCriteria });
      setCriteria(result.criteria);
      setIsEnabledState(result.enabled);
    } catch (err) {
      console.error('Failed to update ISO20022 criteria:', err);
      throw err;
    }
  }, []);

  // Update ISO20022 enabled state
  const setIsEnabled = useCallback(async (enabled: boolean) => {
    try {
      const result = await settingsApi.updateISO20022Settings({ enabled });
      setIsEnabledState(result.enabled);
    } catch (err) {
      console.error('Failed to update ISO20022 enabled state:', err);
      throw err;
    }
  }, []);

  // Update SWIFT MT criteria
  const updateMTCriteria = useCallback(async (newCriteria: SwiftMTValidationCriteria) => {
    try {
      const result = await settingsApi.updateSwiftMTSettings({ criteria: newCriteria });
      setMTCriteria(result.criteria);
      setIsMTEnabledState(result.enabled);
    } catch (err) {
      console.error('Failed to update SWIFT MT criteria:', err);
      throw err;
    }
  }, []);

  // Update SWIFT MT enabled state
  const setIsMTEnabled = useCallback(async (enabled: boolean) => {
    try {
      const result = await settingsApi.updateSwiftMTSettings({ enabled });
      setIsMTEnabledState(result.enabled);
    } catch (err) {
      console.error('Failed to update SWIFT MT enabled state:', err);
      throw err;
    }
  }, []);

  return (
    <ValidationSettingsContext.Provider value={{
      isLoading,
      error,
      criteria,
      updateCriteria,
      isEnabled,
      setIsEnabled,
      mtCriteria,
      updateMTCriteria,
      isMTEnabled,
      setIsMTEnabled,
      refresh: loadSettings
    }}>
      {children}
    </ValidationSettingsContext.Provider>
  );
};

export const useValidationSettings = () => {
  const context = useContext(ValidationSettingsContext);
  if (!context) {
    throw new Error('useValidationSettings must be used within ValidationSettingsProvider');
  }
  return context;
};
