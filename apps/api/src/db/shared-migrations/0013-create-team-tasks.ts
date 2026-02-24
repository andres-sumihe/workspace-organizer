import type { PoolClient } from 'pg';

export const id = '0013-create-team-tasks';

/**
 * Create team_tasks and team_task_assignments tables.
 * team_tasks stores collaborative tasks linked to team projects.
 * team_task_assignments links tasks to team members for collaborative assignment.
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Team tasks table
  await client.query(`
    CREATE TABLE IF NOT EXISTS team_tasks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      project_id UUID NOT NULL REFERENCES team_projects(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      priority VARCHAR(50) NOT NULL DEFAULT 'medium',
      due_date DATE,
      created_by_email VARCHAR(255) NOT NULL,
      updated_by_email VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_team_tasks_team ON team_tasks (team_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_team_tasks_project ON team_tasks (project_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_team_tasks_status ON team_tasks (project_id, status)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_team_tasks_priority ON team_tasks (project_id, priority)');

  await client.query(`
    DROP TRIGGER IF EXISTS trg_team_tasks_updated_at ON team_tasks;
    CREATE TRIGGER trg_team_tasks_updated_at
    BEFORE UPDATE ON team_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  // Task assignments table
  await client.query(`
    CREATE TABLE IF NOT EXISTS team_task_assignments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      task_id UUID NOT NULL REFERENCES team_tasks(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      display_name VARCHAR(255),
      assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT team_task_assignments_unique UNIQUE (task_id, email)
    )
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_team_task_assignments_task ON team_task_assignments (task_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_team_task_assignments_email ON team_task_assignments (email)');
};
