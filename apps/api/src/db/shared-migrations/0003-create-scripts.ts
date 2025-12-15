import type { PoolClient } from 'pg';

export const id = '0003-create-scripts';

/**
 * Migration: Scripts Table
 * 
 * Stores batch scripts shared across the team.
 * Scripts can reference drive mappings and be linked to Control-M jobs.
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Create scripts table
  await client.query(`
    CREATE TABLE IF NOT EXISTS scripts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      file_path VARCHAR(1000),
      content TEXT,
      type VARCHAR(50) DEFAULT 'batch',
      is_active BOOLEAN DEFAULT true,
      tags TEXT[],
      created_by VARCHAR(255),
      updated_by VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  // Create trigger for updated_at
  await client.query(`
    DROP TRIGGER IF EXISTS trg_scripts_updated_at ON scripts;
    CREATE TRIGGER trg_scripts_updated_at
    BEFORE UPDATE ON scripts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  // Create indexes
  await client.query('CREATE INDEX IF NOT EXISTS idx_scripts_team ON scripts (team_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_scripts_name ON scripts (name)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_scripts_type ON scripts (type)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_scripts_is_active ON scripts (is_active)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_scripts_tags ON scripts USING GIN (tags)');

  // Create drive_mappings table
  await client.query(`
    CREATE TABLE IF NOT EXISTS drive_mappings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
      drive_letter CHAR(1) NOT NULL,
      unc_path VARCHAR(1000) NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_by_email VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT drive_mappings_team_letter_unique UNIQUE (team_id, drive_letter)
    )
  `);

  // Create trigger for drive_mappings updated_at
  await client.query(`
    DROP TRIGGER IF EXISTS trg_drive_mappings_updated_at ON drive_mappings;
    CREATE TRIGGER trg_drive_mappings_updated_at
    BEFORE UPDATE ON drive_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  // Create indexes for drive_mappings
  await client.query('CREATE INDEX IF NOT EXISTS idx_drive_mappings_team ON drive_mappings (team_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_drive_mappings_letter ON drive_mappings (drive_letter)');

  // Create script_drive_mappings junction table
  await client.query(`
    CREATE TABLE IF NOT EXISTS script_drive_mappings (
      script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
      drive_mapping_id UUID NOT NULL REFERENCES drive_mappings(id) ON DELETE CASCADE,
      PRIMARY KEY (script_id, drive_mapping_id)
    )
  `);
};
