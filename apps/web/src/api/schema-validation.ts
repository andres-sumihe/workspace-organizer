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
  },

  /**
   * Get unified schema SQL for DBAs to run.
   * Returns complete schema creation script with version tracking.
   */
  async getUnifiedSchemaSQL(): Promise<{ success: boolean; version: number; minVersion: number; sql: string; instructions: string[] }> {
    const response = await fetch(`${API_BASE}/api/v1/team-config/schema-sql/preview`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to get schema SQL');
    }

    return response.json();
  },

  /**
   * Download unified schema SQL as a file.
   */
  async downloadSchemaSQL(): Promise<void> {
    const response = await fetch(`${API_BASE}/api/v1/team-config/schema-sql`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error('Failed to download schema SQL');
    }

    const sql = await response.text();
    const blob = new Blob([sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'workspace-organizer-schema.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Validate schema compatibility for a connection.
   */
  async validateSchemaCompatibility(connectionString: string): Promise<{
    success: boolean;
    compatible: boolean;
    schemaExists: boolean;
    currentVersion: number | null;
    requiredVersion: number;
    minVersion: number;
    message: string;
    action: 'none' | 'create_schema' | 'upgrade_schema' | 'downgrade_app';
  }> {
    const response = await fetch(`${API_BASE}/api/v1/team-config/validate-schema`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionString })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to validate schema');
    }

    return response.json();
  },

  /**
   * Get current schema status for connected database.
   */
  async getSchemaStatus(): Promise<{
    success: boolean;
    compatible: boolean;
    schemaExists: boolean;
    currentVersion: number | null;
    requiredVersion: number;
    minVersion: number;
    message: string;
    appSchemaVersion: number;
    appMinSchemaVersion: number;
  }> {
    const response = await fetch(`${API_BASE}/api/v1/team-config/schema-status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to get schema status');
    }

    return response.json();
  }
};
