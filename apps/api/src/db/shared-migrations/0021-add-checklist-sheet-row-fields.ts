import type { PoolClient } from 'pg';

export const id = '0021-add-checklist-sheet-row-fields';

export const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    ALTER TABLE project_checklist_items
      ADD COLUMN IF NOT EXISTS group_title TEXT,
      ADD COLUMN IF NOT EXISTS planned_date DATE,
      ADD COLUMN IF NOT EXISTS planned_time VARCHAR(16),
      ADD COLUMN IF NOT EXISTS location VARCHAR(255),
      ADD COLUMN IF NOT EXISTS pic VARCHAR(255)
  `);
};