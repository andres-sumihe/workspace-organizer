import type { PoolClient } from 'pg';

export const id = '0006-create-app-info';

/**
 * Migration: App Info & Secrets (Team Attestation)
 * 
 * Creates tables for cryptographic team identity verification.
 * 
 * app_info: Public server identity (shared with clients)
 * - server_id: Unique identifier for this team database instance
 * - team_id: The team this database belongs to
 * - public_key: Ed25519 public key for attestation verification
 * 
 * app_secrets: Private secrets (never leaves server)
 * - server_private_key: Ed25519 private key for signing attestations
 * 
 * Security Considerations:
 * - Private key should be rotated periodically in production
 * - Consider using HSM or secure enclave for key storage
 * - Audit access to app_secrets table
 */
export const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    -- Public app identity
    CREATE TABLE IF NOT EXISTS app_info (
      server_id UUID PRIMARY KEY,
      team_id UUID NOT NULL,
      team_name VARCHAR(255) NOT NULL,
      public_key TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Index for team lookups
    CREATE INDEX IF NOT EXISTS idx_app_info_team ON app_info(team_id);

    -- Secure secrets storage
    CREATE TABLE IF NOT EXISTS app_secrets (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Restrict access to secrets table (RLS can be added here)
    COMMENT ON TABLE app_secrets IS 'Secure storage for server secrets. Access should be restricted.';

    -- Teams table for multi-team support
    CREATE TABLE IF NOT EXISTS teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- User-Team membership
    CREATE TABLE IF NOT EXISTS team_members (
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(50) DEFAULT 'member', -- 'owner', 'admin', 'member'
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (team_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
  `);
};

export const down = async (client: PoolClient): Promise<void> => {
  await client.query(`
    DROP TABLE IF EXISTS team_members;
    DROP TABLE IF EXISTS teams;
    DROP TABLE IF EXISTS app_secrets;
    DROP TABLE IF EXISTS app_info;
  `);
};
