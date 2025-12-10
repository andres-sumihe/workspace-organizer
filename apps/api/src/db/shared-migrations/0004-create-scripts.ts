import type { PoolClient } from 'pg';

export const id = '0004-create-scripts';

/**
 * Create scripts and related tables in the shared PostgreSQL database.
 *
 * Tables:
 * - scripts: Core script metadata and content
 * - tags: Script categorization tags
 * - script_tags: Many-to-many scripts<->tags
 * - drive_mappings: Network drive mappings extracted from scripts
 * - script_dependencies: Script dependency relationships
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Create scripts table
  await client.query(`
    CREATE TABLE IF NOT EXISTS scripts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      description TEXT,
      file_path VARCHAR(1000) NOT NULL,
      content TEXT NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'batch',
      is_active BOOLEAN NOT NULL DEFAULT true,
      has_credentials BOOLEAN NOT NULL DEFAULT false,
      execution_count INTEGER NOT NULL DEFAULT 0,
      last_executed_at TIMESTAMP WITH TIME ZONE,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  // Create indexes for scripts
  await client.query('CREATE INDEX IF NOT EXISTS idx_scripts_name ON scripts (name)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_scripts_type ON scripts (type)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_scripts_is_active ON scripts (is_active)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_scripts_file_path ON scripts (file_path)');

  // Create trigger for scripts updated_at
  await client.query(`
    DROP TRIGGER IF EXISTS trg_scripts_updated_at ON scripts;
    CREATE TRIGGER trg_scripts_updated_at
    BEFORE UPDATE ON scripts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  // Create tags table
  await client.query(`
    CREATE TABLE IF NOT EXISTS tags (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(100) NOT NULL,
      color VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT tags_name_unique UNIQUE (name)
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

  // Create indexes for script_tags
  await client.query('CREATE INDEX IF NOT EXISTS idx_script_tags_script ON script_tags (script_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_script_tags_tag ON script_tags (tag_id)');

  // Create drive_mappings table
  await client.query(`
    CREATE TABLE IF NOT EXISTS drive_mappings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
      drive_letter VARCHAR(5) NOT NULL,
      network_path VARCHAR(1000) NOT NULL,
      server_name VARCHAR(255),
      share_name VARCHAR(255),
      has_credentials BOOLEAN NOT NULL DEFAULT false,
      username VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  // Create indexes for drive_mappings
  await client.query('CREATE INDEX IF NOT EXISTS idx_drive_mappings_script ON drive_mappings (script_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_drive_mappings_drive ON drive_mappings (drive_letter)');

  // Create trigger for drive_mappings updated_at
  await client.query(`
    DROP TRIGGER IF EXISTS trg_drive_mappings_updated_at ON drive_mappings;
    CREATE TRIGGER trg_drive_mappings_updated_at
    BEFORE UPDATE ON drive_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  // Create script_dependencies table
  await client.query(`
    CREATE TABLE IF NOT EXISTS script_dependencies (
      dependent_script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
      dependency_script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      PRIMARY KEY (dependent_script_id, dependency_script_id),
      CONSTRAINT no_self_dependency CHECK (dependent_script_id != dependency_script_id)
    )
  `);

  // Create indexes for script_dependencies
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_script_deps_dependent ON script_dependencies (dependent_script_id)'
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_script_deps_dependency ON script_dependencies (dependency_script_id)'
  );
};
