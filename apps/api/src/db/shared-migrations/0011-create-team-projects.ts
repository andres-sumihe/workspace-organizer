import type { PoolClient } from 'pg';

export const id = '0011-create-team-projects';

/**
 * Create team_projects table for collaborative projects stored in shared PostgreSQL.
 * Mirrors the personal_projects structure but scoped to teams.
 */
export const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS team_projects (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      start_date DATE,
      due_date DATE,
      actual_end_date DATE,
      business_proposal_id VARCHAR(255),
      change_id VARCHAR(255),
      created_by_email VARCHAR(255) NOT NULL,
      updated_by_email VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  // Indexes
  await client.query('CREATE INDEX IF NOT EXISTS idx_team_projects_team ON team_projects (team_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_team_projects_status ON team_projects (team_id, status)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_team_projects_created_by ON team_projects (created_by_email)');

  // updated_at trigger
  await client.query(`
    DROP TRIGGER IF EXISTS trg_team_projects_updated_at ON team_projects;
    CREATE TRIGGER trg_team_projects_updated_at
    BEFORE UPDATE ON team_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);
};
