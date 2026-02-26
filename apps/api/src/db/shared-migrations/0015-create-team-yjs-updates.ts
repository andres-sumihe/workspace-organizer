import type { PoolClient } from 'pg';

export const id = '0015-create-team-yjs-updates';

/**
 * Create team_yjs_updates table for Yjs collaborative document persistence.
 * Stores binary Yjs state snapshots keyed by document name.
 * Used by Hocuspocus extension-database for loading and storing Yjs documents.
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Yjs document state table – stores the merged Yjs state per document
  await client.query(`
    CREATE TABLE IF NOT EXISTS team_yjs_updates (
      id SERIAL PRIMARY KEY,
      document_name VARCHAR(500) NOT NULL UNIQUE,
      state BYTEA NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_team_yjs_updates_doc ON team_yjs_updates (document_name)');

  await client.query(`
    DROP TRIGGER IF EXISTS trg_team_yjs_updates_updated_at ON team_yjs_updates;
    CREATE TRIGGER trg_team_yjs_updates_updated_at
    BEFORE UPDATE ON team_yjs_updates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column()
  `);
};
