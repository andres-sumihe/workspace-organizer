import type { PoolClient } from 'pg';

export const id = '0016-enhance-note-revisions';

/**
 * Enhance team_note_revisions for collaboration-aware history.
 *
 * Adds:
 *  - title: snapshot of the note title at the time of capture
 *  - editors: JSONB array of emails who contributed to this version
 *  - snapshot_trigger: what caused the snapshot (auto, disconnect, manual, restore)
 */
export const up = async (client: PoolClient): Promise<void> => {
  // Add new columns (IF NOT EXISTS via safe ALTER path)
  await client.query(`
    ALTER TABLE team_note_revisions
      ADD COLUMN IF NOT EXISTS title VARCHAR(255),
      ADD COLUMN IF NOT EXISTS editors JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS snapshot_trigger VARCHAR(50) NOT NULL DEFAULT 'auto'
  `);

  // Back-fill title from the parent note for existing revisions
  await client.query(`
    UPDATE team_note_revisions r
    SET title = n.title
    FROM team_notes n
    WHERE r.note_id = n.id AND r.title IS NULL
  `);
};
