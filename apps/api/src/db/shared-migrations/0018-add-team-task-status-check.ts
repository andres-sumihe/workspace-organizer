import type { PoolClient } from 'pg';

export const id = '0018-add-team-task-status-check';

export const up = async (client: PoolClient): Promise<void> => {
  await client.query('ALTER TABLE team_tasks DROP CONSTRAINT IF EXISTS team_tasks_status_check');
  await client.query(`
    ALTER TABLE team_tasks
    ADD CONSTRAINT team_tasks_status_check
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'backlog')) NOT VALID
  `);
};