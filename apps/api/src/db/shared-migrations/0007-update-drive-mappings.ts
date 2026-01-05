import type { PoolClient } from 'pg';

export const id = '0007-update-drive-mappings';

/**
 * Migration: Update Drive Mappings
 * 
 * Updates the drive_mappings table to match the repository implementation.
 * Changes from a shared entity model to a script-child model.
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Drop the junction table first
  await client.query('DROP TABLE IF EXISTS script_drive_mappings');

  // Drop the existing drive_mappings table
  // We are changing the schema significantly, so it's cleaner to drop and recreate
  // assuming we don't have critical production data yet (dev environment)
  await client.query('DROP TABLE IF EXISTS drive_mappings');

  // Recreate drive_mappings with the correct schema
  await client.query(`
    CREATE TABLE drive_mappings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
      drive_letter VARCHAR(5) NOT NULL,
      network_path VARCHAR(1000) NOT NULL,
      server_name VARCHAR(255),
      share_name VARCHAR(255),
      has_credentials BOOLEAN DEFAULT false,
      username VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  // Create trigger for updated_at
  await client.query(`
    DROP TRIGGER IF EXISTS trg_drive_mappings_updated_at ON drive_mappings;
    CREATE TRIGGER trg_drive_mappings_updated_at
    BEFORE UPDATE ON drive_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  // Create indexes
  await client.query('CREATE INDEX idx_drive_mappings_script_id ON drive_mappings(script_id)');
  await client.query('CREATE INDEX idx_drive_mappings_drive_letter ON drive_mappings(drive_letter)');
};
