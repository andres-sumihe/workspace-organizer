import { settingsRepository, type Setting } from '../repositories/settings.repository.js';

// Validation settings types
export interface ISO20022ValidationCriteria {
  senderDN: string;
  senderFullName: string;
  receiverDN: string;
  receiverFullName: string;
}

export interface SwiftMTValidationCriteria {
  senderBIC: string;
  receiverBIC: string;
  validateFormat: boolean;
  expectedFormat?: 'dos_pcc' | 'rje' | 'fin' | null;
}

export interface ValidationSettings {
  iso20022: {
    enabled: boolean;
    criteria: ISO20022ValidationCriteria;
  };
  swiftMT: {
    enabled: boolean;
    criteria: SwiftMTValidationCriteria;
  };
}

// Default values
const DEFAULT_ISO20022_CRITERIA: ISO20022ValidationCriteria = {
  senderDN: 'ou=xxx,o=cenaidja,o=swift',
  senderFullName: 'CENAIDJAXXX',
  receiverDN: 'ou=xxx,o=cenaidja,o=swift',
  receiverFullName: 'CENAIDJAXXX'
};

const DEFAULT_SWIFT_MT_CRITERIA: SwiftMTValidationCriteria = {
  senderBIC: '',
  receiverBIC: '',
  validateFormat: false,
  expectedFormat: null
};

export const settingsService = {
  /**
   * Get a single setting by key
   */
  async get<T>(key: string): Promise<T | null> {
    const setting = await settingsRepository.get<T>(key);
    return setting?.value ?? null;
  },

  /**
   * Set a single setting
   */
  async set<T>(key: string, value: T, description?: string): Promise<Setting<T>> {
    return settingsRepository.set(key, value, description);
  },

  /**
   * Get all validation settings
   */
  async getValidationSettings(): Promise<ValidationSettings> {
    const [iso20022Criteria, iso20022Enabled, swiftMTCriteria, swiftMTEnabled] = await Promise.all([
      settingsRepository.get<ISO20022ValidationCriteria>('validation.iso20022'),
      settingsRepository.get<boolean>('validation.iso20022.enabled'),
      settingsRepository.get<SwiftMTValidationCriteria>('validation.swiftMT'),
      settingsRepository.get<boolean>('validation.swiftMT.enabled')
    ]);

    return {
      iso20022: {
        enabled: iso20022Enabled?.value ?? true,
        criteria: iso20022Criteria?.value ?? DEFAULT_ISO20022_CRITERIA
      },
      swiftMT: {
        enabled: swiftMTEnabled?.value ?? false,
        criteria: swiftMTCriteria?.value ?? DEFAULT_SWIFT_MT_CRITERIA
      }
    };
  },

  /**
   * Update ISO20022 validation settings
   */
  async updateISO20022Settings(
    criteria: Partial<ISO20022ValidationCriteria>,
    enabled?: boolean
  ): Promise<ValidationSettings['iso20022']> {
    const current = await settingsRepository.get<ISO20022ValidationCriteria>('validation.iso20022');
    const merged = { ...DEFAULT_ISO20022_CRITERIA, ...current?.value, ...criteria };
    
    await settingsRepository.set('validation.iso20022', merged);
    
    if (enabled !== undefined) {
      await settingsRepository.set('validation.iso20022.enabled', enabled);
    }
    
    const currentEnabled = await settingsRepository.get<boolean>('validation.iso20022.enabled');
    
    return {
      enabled: enabled ?? currentEnabled?.value ?? true,
      criteria: merged
    };
  },

  /**
   * Update SWIFT MT validation settings
   */
  async updateSwiftMTSettings(
    criteria: Partial<SwiftMTValidationCriteria>,
    enabled?: boolean
  ): Promise<ValidationSettings['swiftMT']> {
    const current = await settingsRepository.get<SwiftMTValidationCriteria>('validation.swiftMT');
    const merged = { ...DEFAULT_SWIFT_MT_CRITERIA, ...current?.value, ...criteria };
    
    await settingsRepository.set('validation.swiftMT', merged);
    
    if (enabled !== undefined) {
      await settingsRepository.set('validation.swiftMT.enabled', enabled);
    }
    
    const currentEnabled = await settingsRepository.get<boolean>('validation.swiftMT.enabled');
    
    return {
      enabled: enabled ?? currentEnabled?.value ?? false,
      criteria: merged
    };
  },

  /**
   * Get all settings
   */
  async getAllSettings(): Promise<Setting[]> {
    return settingsRepository.getAll();
  },

  /**
   * Reset validation settings to defaults
   */
  async resetValidationSettings(): Promise<ValidationSettings> {
    await Promise.all([
      settingsRepository.set('validation.iso20022', DEFAULT_ISO20022_CRITERIA),
      settingsRepository.set('validation.iso20022.enabled', true),
      settingsRepository.set('validation.swiftMT', DEFAULT_SWIFT_MT_CRITERIA),
      settingsRepository.set('validation.swiftMT.enabled', false)
    ]);
    
    return {
      iso20022: {
        enabled: true,
        criteria: DEFAULT_ISO20022_CRITERIA
      },
      swiftMT: {
        enabled: false,
        criteria: DEFAULT_SWIFT_MT_CRITERIA
      }
    };
  }
};
