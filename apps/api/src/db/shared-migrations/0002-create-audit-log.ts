import type { PoolClient } from 'pg';

export const id = '0002-create-audit-log';

/**
 * Create audit_log table for tracking all changes to shared resources.
 *
 * Captures:
 * - Who made the change (member_email - links to local user via email)
 * - What action was performed (action)
 * - Which resource type and ID (resource_type, resource_id)
 * - Before and after state (old_value, new_value as JSONB)
 * - Request context (ip_address, user_agent)
 * - When it happened (timestamp)
 * 
 * NOTE: We use member_email instead of user_id because authentication
 * is local (SQLite) and we can't reference local user IDs from PostgreSQL.
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Create audit_log table
  await client.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
      member_email VARCHAR(255),
      member_display_name VARCHAR(255),
      action VARCHAR(50) NOT NULL,
      resource_type VARCHAR(100) NOT NULL,
      resource_id VARCHAR(255),
      old_value JSONB,
      new_value JSONB,
      ip_address INET,
      user_agent TEXT,
      metadata JSONB,
      timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  // Create indexes for efficient querying
  await client.query('CREATE INDEX IF NOT EXISTS idx_audit_log_team_id ON audit_log (team_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_audit_log_member_email ON audit_log (member_email)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type ON audit_log (resource_type)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_audit_log_resource_id ON audit_log (resource_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp DESC)');

  // Composite index for common queries
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_log_resource
    ON audit_log (resource_type, resource_id, timestamp DESC)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_audit_log_member_timestamp
    ON audit_log (member_email, timestamp DESC)
  `);
};
