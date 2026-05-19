import type { PoolClient } from 'pg';

export const id = '0020-create-project-checklists';

export const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS project_checklists (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      project_id UUID NOT NULL REFERENCES team_projects(id) ON DELETE CASCADE,
      template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE RESTRICT,
      template_version_id UUID NOT NULL REFERENCES checklist_template_versions(id) ON DELETE RESTRICT,
      title VARCHAR(255) NOT NULL,
      created_by_email VARCHAR(255),
      updated_by_email VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS project_checklist_sections (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      checklist_id UUID NOT NULL REFERENCES project_checklists(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS project_checklist_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      checklist_id UUID NOT NULL REFERENCES project_checklists(id) ON DELETE CASCADE,
      section_id UUID NOT NULL REFERENCES project_checklist_sections(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'not_applicable')),
      owner VARCHAR(255),
      notes TEXT,
      evidence_url TEXT,
      completed_by_email VARCHAR(255),
      completed_at TIMESTAMP WITH TIME ZONE,
      sort_order INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_project_checklists_team_project ON project_checklists (team_id, project_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_project_checklist_sections_checklist ON project_checklist_sections (checklist_id, sort_order)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_project_checklist_items_checklist ON project_checklist_items (checklist_id, sort_order)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_project_checklist_items_section ON project_checklist_items (section_id, sort_order)');

  await client.query(`
    DROP TRIGGER IF EXISTS trg_project_checklists_updated_at ON project_checklists;
    CREATE TRIGGER trg_project_checklists_updated_at
    BEFORE UPDATE ON project_checklists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  await client.query(`
    DROP TRIGGER IF EXISTS trg_project_checklist_items_updated_at ON project_checklist_items;
    CREATE TRIGGER trg_project_checklist_items_updated_at
    BEFORE UPDATE ON project_checklist_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);
};