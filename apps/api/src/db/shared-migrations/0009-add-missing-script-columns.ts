import type { PoolClient } from 'pg';

export const id = '0009-add-missing-script-columns';

/**
 * Migration: Add Missing Script Columns
 * 
 * Adds has_credentials column to scripts table.
 * Removes deprecated columns: execution_count, last_executed_at.
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Add has_credentials column if it doesn't exist
  await client.query(`
    ALTER TABLE scripts
    ADD COLUMN IF NOT EXISTS has_credentials BOOLEAN DEFAULT false
  `);

  // Remove deprecated columns (these are not needed - app is static, no execution tracking)
  await client.query(`
    ALTER TABLE scripts
    DROP COLUMN IF EXISTS execution_count
  `);

  await client.query(`
    ALTER TABLE scripts
    DROP COLUMN IF EXISTS last_executed_at
  `);

  // Remove deprecated file_path column (using name-based matching instead)
  await client.query(`
    ALTER TABLE scripts
    DROP COLUMN IF EXISTS file_path
  `);
};
