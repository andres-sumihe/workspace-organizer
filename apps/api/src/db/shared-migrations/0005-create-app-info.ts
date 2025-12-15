import type { PoolClient } from 'pg';

export const id = '0005-create-app-info';

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
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Public app identity
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_info (
      server_id UUID PRIMARY KEY,
      team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
      team_name VARCHAR(255) NOT NULL,
      public_key TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Index for team lookups
  await client.query('CREATE INDEX IF NOT EXISTS idx_app_info_team ON app_info(team_id)');

  // Secure secrets storage
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_secrets (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  // Add comment for documentation
  await client.query(`COMMENT ON TABLE app_secrets IS 'Secure storage for server secrets. Access should be restricted.'`);
};
