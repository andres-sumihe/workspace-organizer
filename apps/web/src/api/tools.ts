import { apiClient } from './client';

import type {
  ToolsGeneralSettings,
  OvertimeEntry,
  OvertimeEntryListResponse,
  OvertimeEntryResponse,
  CreateOvertimeEntryRequest
} from '@workspace/shared';

export interface OvertimeStatistics {
  totalEntries: number;
  totalHours: number;
  totalPay: number;
}

export interface OvertimeCalculatePreviewRequest {
  baseSalary: number;
  totalHours: number;
  dayType: 'workday' | 'holiday_weekend';
}

export interface OvertimeCalculatePreviewResponse {
  baseSalary: number;
  totalHours: number;
  dayType: 'workday' | 'holiday_weekend';
  baseHourly: number;
  payAmount: number;
}

export interface OvertimeEntriesParams {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
}

export const toolsApi = {
  // Settings - Tools General
  
  /**
   * Get tools general settings (base salary, etc.)
   */
  getGeneralSettings: () =>
    apiClient.get<ToolsGeneralSettings>('/api/v1/settings/tools/general'),

  /**
   * Update tools general settings
   */
  updateGeneralSettings: (data: Partial<ToolsGeneralSettings>) =>
    apiClient.put<ToolsGeneralSettings>('/api/v1/settings/tools/general', data),

  // Overtime Entries

  /**
   * List overtime entries with optional date range filter
   */
  listOvertimeEntries: (params?: OvertimeEntriesParams) =>
    apiClient.get<OvertimeEntryListResponse>('/api/v1/tools/overtime/entries', {
      query: params as Record<string, string | undefined>
    }),

  /**
   * Create a new overtime entry
   */
  createOvertimeEntry: (data: CreateOvertimeEntryRequest) =>
    apiClient.post<OvertimeEntryResponse>('/api/v1/tools/overtime/entries', data),

  /**
   * Delete an overtime entry by ID
   */
  deleteOvertimeEntry: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/tools/overtime/entries/${id}`);
  },

  /**
   * Get overtime statistics for a date range
   */
  getOvertimeStatistics: (params?: OvertimeEntriesParams) =>
    apiClient.get<OvertimeStatistics>('/api/v1/tools/overtime/statistics', {
      query: params as Record<string, string | undefined>
    }),

  /**
   * Calculate overtime pay preview (without saving)
   */
  calculateOvertimePreview: (data: OvertimeCalculatePreviewRequest) =>
    apiClient.post<OvertimeCalculatePreviewResponse>('/api/v1/tools/overtime/calculate', data)
};

export type { OvertimeEntry, ToolsGeneralSettings, CreateOvertimeEntryRequest };
