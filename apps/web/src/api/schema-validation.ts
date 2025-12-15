const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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

export interface ResetAndMigrateResponse {
  success: boolean;
  reset: {
    success: boolean;
    message: string;
    tablesDropped: string[];
  };
  migrations: {
    count: number;
    executed: string[];
  };
  validation: ValidationResponse;
  message?: string;
}

export const schemaValidationApi = {
  /**
   * Validate all shared database tables
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
   * Reset database and re-run all migrations
   * WARNING: This is destructive and will delete all team data!
   */
  async resetAndMigrate(): Promise<ResetAndMigrateResponse> {
    const response = await fetch(`${API_BASE}/api/v1/schema-validation/reset-and-migrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to reset and migrate database');
    }

    return response.json();
  }
};
