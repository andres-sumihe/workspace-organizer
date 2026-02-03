import type { PoolClient } from 'pg';

export const id = '0003-create-scripts';

/**
 * Migration: Scripts Table
 * 
 * Stores batch scripts shared across the team.
 * Scripts can have drive mappings and be linked to Control-M jobs.
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Create scripts table
  await client.query(`
    CREATE TABLE IF NOT EXISTS scripts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      content TEXT,
      type VARCHAR(50) DEFAULT 'batch',
      is_active BOOLEAN DEFAULT true,
      has_credentials BOOLEAN DEFAULT false,
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

  // Create drive_mappings table (per-script mappings)
  await client.query(`
    CREATE TABLE IF NOT EXISTS drive_mappings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
      drive_letter CHAR(1) NOT NULL,
      network_path VARCHAR(1000) NOT NULL,
      server_name VARCHAR(255),
      has_credentials BOOLEAN DEFAULT false,
      username VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT drive_mappings_script_letter_unique UNIQUE (script_id, drive_letter)
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
  await client.query('CREATE INDEX IF NOT EXISTS idx_drive_mappings_script ON drive_mappings (script_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_drive_mappings_letter ON drive_mappings (drive_letter)');
};
