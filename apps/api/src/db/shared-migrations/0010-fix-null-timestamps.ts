import type { PoolClient } from 'pg';

export const id = '0010-fix-null-timestamps';

/**
 * Migration: Fix Null Timestamps
 * 
 * Updates any scripts, drive_mappings, tags, or script_tags rows
 * where created_at or updated_at are NULL, setting them to NOW().
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Fix scripts timestamps
  await client.query(`
    UPDATE scripts 
    SET created_at = NOW() 
    WHERE created_at IS NULL
  `);
  
  await client.query(`
    UPDATE scripts 
    SET updated_at = NOW() 
    WHERE updated_at IS NULL
  `);

  // Fix drive_mappings timestamps
  await client.query(`
    UPDATE drive_mappings 
    SET created_at = NOW() 
    WHERE created_at IS NULL
  `);
  
  await client.query(`
    UPDATE drive_mappings 
    SET updated_at = NOW() 
    WHERE updated_at IS NULL
  `);

  // Fix tags timestamps
  await client.query(`
    UPDATE tags 
    SET created_at = NOW() 
    WHERE created_at IS NULL
  `);
  
  await client.query(`
    UPDATE tags 
    SET updated_at = NOW() 
    WHERE updated_at IS NULL
  `);
};
