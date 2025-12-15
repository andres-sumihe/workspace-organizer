import type { PoolClient } from 'pg';

export const id = '0001-create-teams';

/**
 * Create teams and team_members tables.
 * 
 * IMPORTANT: Authentication is ALWAYS local (SQLite).
 * This shared database only stores team data, NOT user credentials.
 * 
 * team_members links local users to teams via email address.
 * The email acts as a stable identifier across different local installations.
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Enable UUID extension if not exists
  await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  // Create updated_at trigger function
  await client.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  // Create teams table
  await client.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_by_email VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT teams_name_unique UNIQUE (name)
    )
  `);

  // Create trigger for teams updated_at
  await client.query(`
    DROP TRIGGER IF EXISTS trg_teams_updated_at ON teams;
    CREATE TRIGGER trg_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  // Create team_members table
  // Links local users (via email) to teams
  await client.query(`
    CREATE TABLE IF NOT EXISTS team_members (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      display_name VARCHAR(255),
      role VARCHAR(50) NOT NULL DEFAULT 'member',
      joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT team_members_team_email_unique UNIQUE (team_id, email)
    )
  `);

  // Role values: 'owner', 'admin', 'member'

  // Create indexes
  await client.query('CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members (team_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members (email)');

  // Create trigger for team_members updated_at
  await client.query(`
    DROP TRIGGER IF EXISTS trg_team_members_updated_at ON team_members;
    CREATE TRIGGER trg_team_members_updated_at
    BEFORE UPDATE ON team_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);
};
