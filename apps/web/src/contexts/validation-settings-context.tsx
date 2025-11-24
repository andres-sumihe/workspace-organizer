import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

import type { ISO20022ValidationCriteria } from '@/utils/iso20022-validator';

interface ValidationSettingsContextValue {
  criteria: ISO20022ValidationCriteria;
  updateCriteria: (criteria: ISO20022ValidationCriteria) => void;
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
}

const ValidationSettingsContext = createContext<ValidationSettingsContextValue | undefined>(undefined);

const DEFAULT_CRITERIA: ISO20022ValidationCriteria = {
  senderDN: 'ou=xxx,o=cenaidja,o=swift',
  senderFullName: 'CENAIDJAXXX',
  receiverDN: 'ou=xxx,o=cenaidja,o=swift',
  receiverFullName: 'CENAIDJAXXX'
};

const STORAGE_KEY = 'workspace-organizer-validation-settings';

export const ValidationSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [criteria, setCriteria] = useState<ISO20022ValidationCriteria>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_CRITERIA, ...parsed.criteria };
      }
    } catch {
      // Ignore errors
    }
    return DEFAULT_CRITERIA;
  });

  const [isEnabled, setIsEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.isEnabled !== false; // Default to true
      }
    } catch {
      // Ignore errors
    }
    return true;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ criteria, isEnabled }));
    } catch {
      // Ignore errors
    }
  }, [criteria, isEnabled]);

  const updateCriteria = (newCriteria: ISO20022ValidationCriteria) => {
    setCriteria(newCriteria);
  };

  return (
    <ValidationSettingsContext.Provider value={{ criteria, updateCriteria, isEnabled, setIsEnabled }}>
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
