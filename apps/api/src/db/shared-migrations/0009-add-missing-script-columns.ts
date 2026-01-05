import type { PoolClient } from 'pg';

export const id = '0009-add-missing-script-columns';

/**
 * Migration: Add Missing Script Columns
 * 
 * Adds has_credentials and execution_count columns to scripts table.
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Add has_credentials column if it doesn't exist
  await client.query(`
    ALTER TABLE scripts
    ADD COLUMN IF NOT EXISTS has_credentials BOOLEAN DEFAULT false
  `);

  // Add execution_count column if it doesn't exist
  await client.query(`
    ALTER TABLE scripts
    ADD COLUMN IF NOT EXISTS execution_count INTEGER DEFAULT 0
  `);

  // Add last_executed_at column if it doesn't exist
  await client.query(`
    ALTER TABLE scripts
    ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMP WITH TIME ZONE
  `);
};
