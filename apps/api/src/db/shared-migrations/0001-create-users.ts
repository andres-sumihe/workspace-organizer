import type { PoolClient } from 'pg';

export const id = '0001-create-users';

/**
 * Create users and sessions tables for authentication.
 *
 * Tables:
 * - users: User accounts for authentication
 * - sessions: Active user sessions for token management
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Enable UUID extension if not exists
  await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Create users table
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      username VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(255),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT users_username_unique UNIQUE (username),
      CONSTRAINT users_email_unique UNIQUE (email)
    )
  `);

  // Create indexes for users table
  await client.query('CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active)');

  // Create sessions table
  await client.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      refresh_token_hash VARCHAR(255),
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      refresh_expires_at TIMESTAMP WITH TIME ZONE,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT sessions_token_hash_unique UNIQUE (token_hash)
    )
  `);

  // Create indexes for sessions table
  await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at)');
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions (refresh_token_hash)'
  );

  // Create trigger to auto-update updated_at on users
  await client.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  await client.query(`
    DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
    CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);
};
