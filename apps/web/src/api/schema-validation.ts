// Use relative URLs by default - works with both Vite proxy and Electron protocol handler
const API_BASE = import.meta.env.VITE_API_URL || '';

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

export interface SchemaValidationResult {
  table: string;
  exists: boolean;
  expectedColumns?: string[];
  actualColumns?: string[];
  missingColumns?: string[];
  extraColumns?: string[];
  valid: boolean;
  errors: string[];
}

export interface ValidationResponse {
  valid: boolean;
  tables: Record<string, SchemaValidationResult>;
  summary: {
    total: number;
    valid: number;
    invalid: number;
    missing: number;
  };
}

export interface MigrationHistoryEntry {
  id: string;
  executed_at: string;
  executed_by: string | null;
  hostname: string | null;
}

export interface MigrationScript {
  id: string;
  description: string;
  status: 'pending' | 'executed';
  sql: string;
}

export interface ExportScriptsResponse {
  success: boolean;
  format: 'individual' | 'combined';
  dbConnected: boolean;
  pendingCount: number;
  totalCount: number;
  schemaSetup: string;
  migrations: MigrationScript[];
  instructions: string[];
}

export const schemaValidationApi = {
  /**
   * Validate all shared database tables.
   * No authentication required.
   */
  async validate(): Promise<ValidationResponse> {
    const response = await fetch(`${API_BASE}/api/v1/schema-validation/validate`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to validate schema');
    }

    return response.json();
  },

  /**
   * Get pending migrations that haven't been executed yet.
   * No authentication required.
   */
  async getPendingMigrations(): Promise<{ success: boolean; pendingMigrations: string[]; count: number; dbConnected: boolean }> {
    const response = await fetch(`${API_BASE}/api/v1/schema-validation/pending`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to get pending migrations');
    }

    return response.json();
  },

  /**
   * Get migration execution history.
   * No authentication required.
   */
  async getMigrationHistory(): Promise<{ success: boolean; history: MigrationHistoryEntry[]; dbConnected: boolean }> {
    const response = await fetch(`${API_BASE}/api/v1/schema-validation/history`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to get migration history');
    }

    return response.json();
  },

  /**
   * Export migration SQL scripts for DBA execution.
   * Returns actual SQL content that can be copied and executed.
   * No authentication required.
   * 
   * @param pendingOnly - If true, only return pending migrations
   */
  async exportScripts(pendingOnly = false): Promise<ExportScriptsResponse> {
    const params = new URLSearchParams();
    if (pendingOnly) params.set('pending', 'true');

    const response = await fetch(`${API_BASE}/api/v1/schema-validation/export-scripts?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to export scripts');
    }

    return response.json();
  }
};
