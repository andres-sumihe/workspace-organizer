import type { PoolClient } from 'pg';

export const id = '0019-create-checklist-templates';

export const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS checklist_templates (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      created_by_email VARCHAR(255),
      updated_by_email VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS checklist_template_versions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
      version_label VARCHAR(255) NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      mime_type VARCHAR(255) NOT NULL,
      size_bytes BIGINT NOT NULL,
      checksum_sha256 VARCHAR(64) NOT NULL,
      xlsx_blob BYTEA NOT NULL,
      mapping_json JSONB,
      mapping_status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (mapping_status IN ('pending', 'parsed', 'failed')),
      is_active BOOLEAN NOT NULL DEFAULT FALSE,
      uploaded_by_email VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_checklist_templates_team ON checklist_templates (team_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_checklist_template_versions_template ON checklist_template_versions (template_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_checklist_template_versions_checksum ON checklist_template_versions (checksum_sha256)');

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_templates_one_active_per_team
      ON checklist_templates (team_id)
      WHERE is_active = TRUE
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_template_versions_one_active
      ON checklist_template_versions (template_id)
      WHERE is_active = TRUE
  `);

  await client.query(`
    DROP TRIGGER IF EXISTS trg_checklist_templates_updated_at ON checklist_templates;
    CREATE TRIGGER trg_checklist_templates_updated_at
    BEFORE UPDATE ON checklist_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);
};