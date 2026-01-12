import { dbLogger } from '../../utils/logger.js';

import type { PoolClient } from 'pg';

export const id = '0006-create-tags';

/**
 * Migration: Tags Table
 * 
 * Creates tags and script_tags tables for better tag management.
 * Replaces the array-based tags column in scripts table.
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Create tags table
  await client.query(`
    CREATE TABLE IF NOT EXISTS tags (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL UNIQUE,
      color VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  // Create trigger for tags updated_at
  await client.query(`
    DROP TRIGGER IF EXISTS trg_tags_updated_at ON tags;
    CREATE TRIGGER trg_tags_updated_at
    BEFORE UPDATE ON tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  // Create script_tags junction table
  await client.query(`
    CREATE TABLE IF NOT EXISTS script_tags (
      script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
      tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      PRIMARY KEY (script_id, tag_id)
    )
  `);

  // Create indexes
  await client.query('CREATE INDEX IF NOT EXISTS idx_script_tags_script ON script_tags (script_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_script_tags_tag ON script_tags (tag_id)');

  // Migrate existing tags from scripts table if any
  // Note: This assumes the scripts table exists and has a tags column (from migration 0003)
  try {
    const scripts = await client.query('SELECT id, tags FROM scripts WHERE tags IS NOT NULL AND array_length(tags, 1) > 0');
    
    for (const script of scripts.rows) {
      const tags = script.tags as string[];
      for (const tagName of tags) {
        // Create or find tag
        const tagResult = await client.query(
          'INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id',
          [tagName]
        );
        const tagId = tagResult.rows[0].id;

        // Link tag to script
        await client.query(
          'INSERT INTO script_tags (script_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [script.id, tagId]
        );
      }
    }
  } catch (error) {
    dbLogger.warn({ err: error }, 'Failed to migrate existing tags');
    // Continue even if migration fails (e.g. column doesn't exist)
  }
};
