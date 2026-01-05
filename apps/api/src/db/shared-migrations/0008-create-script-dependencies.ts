import type { PoolClient } from 'pg';

export const id = '0008-create-script-dependencies';

/**
 * Migration: Create Script Dependencies
 * 
 * Creates the script_dependencies table to track dependencies between scripts.
 */
export const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS script_dependencies (
      dependent_script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
      dependency_script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      PRIMARY KEY (dependent_script_id, dependency_script_id)
    )
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_script_dependencies_dependent ON script_dependencies(dependent_script_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_script_dependencies_dependency ON script_dependencies(dependency_script_id)');
  
  console.log('Migration 0008-create-script-dependencies completed.');
};
