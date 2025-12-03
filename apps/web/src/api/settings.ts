import { apiClient } from './client';

import type { ISO20022ValidationCriteria } from '@/utils/iso20022-validator';
import type { SwiftMTValidationCriteria } from '@/utils/swift-mt-validator';

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

export const settingsApi = {
  /**
   * Get all validation settings
   */
  getValidationSettings: () => 
    apiClient.get<ValidationSettings>('/api/v1/settings/validation'),

  /**
   * Update ISO20022 validation settings
   */
  updateISO20022Settings: (data: {
    criteria?: Partial<ISO20022ValidationCriteria>;
    enabled?: boolean;
  }) => 
    apiClient.put<ValidationSettings['iso20022']>('/api/v1/settings/validation/iso20022', data),

  /**
   * Update SWIFT MT validation settings
   */
  updateSwiftMTSettings: (data: {
    criteria?: Partial<SwiftMTValidationCriteria>;
    enabled?: boolean;
  }) => 
    apiClient.put<ValidationSettings['swiftMT']>('/api/v1/settings/validation/swift-mt', data),

  /**
   * Reset validation settings to defaults
   */
  resetValidationSettings: () => 
    apiClient.post<ValidationSettings>('/api/v1/settings/validation/reset')
};
