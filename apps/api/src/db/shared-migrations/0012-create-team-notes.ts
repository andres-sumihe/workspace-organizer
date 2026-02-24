import type { PoolClient } from 'pg';

export const id = '0012-create-team-notes';

/**
 * Create team_notes and team_note_revisions tables.
 * team_notes stores collaborative notes linked to team projects.
 * team_note_revisions stores historical snapshots for changes tracking.
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Team notes table
  await client.query(`
    CREATE TABLE IF NOT EXISTS team_notes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      project_id UUID NOT NULL REFERENCES team_projects(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
      created_by_email VARCHAR(255) NOT NULL,
      updated_by_email VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_team_notes_team ON team_notes (team_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_team_notes_project ON team_notes (project_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_team_notes_pinned ON team_notes (project_id, is_pinned)');

  await client.query(`
    DROP TRIGGER IF EXISTS trg_team_notes_updated_at ON team_notes;
    CREATE TRIGGER trg_team_notes_updated_at
    BEFORE UPDATE ON team_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);

  // Note revisions table for changes tracking
  await client.query(`
    CREATE TABLE IF NOT EXISTS team_note_revisions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      note_id UUID NOT NULL REFERENCES team_notes(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      saved_by_email VARCHAR(255) NOT NULL,
      revision_number INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_team_note_revisions_note ON team_note_revisions (note_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_team_note_revisions_number ON team_note_revisions (note_id, revision_number)');
};
