import type { PoolClient } from 'pg';

export const id = '0014-create-team-task-updates';

/**
 * Create team_task_updates table and add flags column to team_tasks.
 * team_task_updates stores collaborative progress notes/comments on team tasks.
 * flags column stores quick status indicators (blocked, urgent, etc.) as JSON.
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Add flags column to team_tasks
  await client.query(`
    ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS flags JSONB NOT NULL DEFAULT '[]'::jsonb
  `);

  // Team task updates table
  await client.query(`
    CREATE TABLE IF NOT EXISTS team_task_updates (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      task_id UUID NOT NULL REFERENCES team_tasks(id) ON DELETE CASCADE,
      parent_id UUID REFERENCES team_task_updates(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_by_email VARCHAR(255) NOT NULL,
      created_by_display_name VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_team_task_updates_task ON team_task_updates (task_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_team_task_updates_parent ON team_task_updates (parent_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_team_task_updates_created_by ON team_task_updates (created_by_email)');

  await client.query(`
    DROP TRIGGER IF EXISTS trg_team_task_updates_updated_at ON team_task_updates;
    CREATE TRIGGER trg_team_task_updates_updated_at
    BEFORE UPDATE ON team_task_updates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);
};
