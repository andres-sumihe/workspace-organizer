/**
 * Hocuspocus extension for session-based note history snapshots.
 *
 * Creates version snapshots of team note content at session boundaries
 * (when the last collaborator disconnects), not on a timer. This matches
 * how Google Docs / Notion handle versioning: the document auto-saves
 * continuously, but history snapshots are only created when a session ends.
 *
 * Triggers handled here:
 *  - **disconnect**: When the last collaborator leaves the document.
 *
 * Other triggers handled by the REST API (see team-notes route):
 *  - **manual**: User clicks "Save Version"
 *  - **session_end**: Editor component unmounts (covers non-collaborative mode)
 *  - **restore**: Before restoring a previous revision
 */

import { isSharedDbConnected, getSharedPool } from '../db/shared-client.js';
import { dbLogger } from '../utils/logger.js';

import type { Extension, onChangePayload, onDisconnectPayload } from '@hocuspocus/server';

const log = dbLogger.child({ module: 'note-history' });

/** Track editing activity per document for session-end snapshots */
interface DocState {
  /** Unique editor emails who contributed during this session */
  editors: Set<string>;
  /** Whether content was modified since the document was opened */
  dirty: boolean;
}

const docStates = new Map<string, DocState>();

function getDocState(docName: string): DocState {
  let state = docStates.get(docName);
  if (!state) {
    state = { editors: new Set(), dirty: false };
    docStates.set(docName, state);
  }
  return state;
}

/** Parse "team-note:{teamId}:{noteId}" → { teamId, noteId } or null */
function parseDocName(name: string): { teamId: string; noteId: string } | null {
  const parts = name.split(':');
  if (parts.length < 3 || parts[0] !== 'team-note') return null;
  return { teamId: parts[1], noteId: parts[2] };
}

/**
 * Save a revision snapshot to the database.
 *
 * Reads the current markdown content from `team_notes.content` (persisted by
 * the editor's auto-save) rather than extracting from the Yjs XmlFragment,
 * which would produce ProseMirror XML instead of markdown. This keeps all
 * stored revisions in a consistent markdown format.
 */
async function saveSnapshot(
  noteId: string,
  savedByEmail: string,
  editors: string[],
  trigger: 'auto' | 'disconnect' | 'manual' | 'session_end' | 'restore',
): Promise<void> {
  if (!isSharedDbConnected()) return;

  try {
    const pool = getSharedPool();

    // Get the note title, content and next revision number + last revision content
    const [noteResult, revResult, lastRevContent] = await Promise.all([
      pool.query<{ title: string; content: string }>('SELECT title, content FROM team_notes WHERE id = $1', [noteId]),
      pool.query<{ max_rev: number | null }>(
        'SELECT MAX(revision_number) as max_rev FROM team_note_revisions WHERE note_id = $1',
        [noteId],
      ),
      pool.query<{ content: string }>(
        'SELECT content FROM team_note_revisions WHERE note_id = $1 ORDER BY revision_number DESC LIMIT 1',
        [noteId],
      ),
    ]);

    if (noteResult.rows.length === 0) {
      log.warn({ noteId }, 'Note not found — skipping snapshot');
      return;
    }

    const { title, content } = noteResult.rows[0];
    const nextRevision = (revResult.rows[0]?.max_rev ?? 0) + 1;

    // Skip snapshot if content is empty (note not yet saved by editor)
    if (!content) {
      log.debug({ noteId, trigger }, 'Skipping snapshot — note has no saved content yet');
      return;
    }

    // Skip snapshot if content hasn't changed since the last revision
    if (lastRevContent.rows.length > 0 && lastRevContent.rows[0].content === content) {
      log.debug({ noteId, trigger }, 'Skipping snapshot — content unchanged since last revision');
      return;
    }

    await pool.query(
      `INSERT INTO team_note_revisions (note_id, title, content, saved_by_email, editors, revision_number, snapshot_trigger)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [noteId, title, content, savedByEmail, JSON.stringify(editors), nextRevision, trigger],
    );

    log.debug({ noteId, revisionNumber: nextRevision, trigger }, 'Saved note history snapshot');
  } catch (err) {
    log.error({ err, noteId, trigger }, 'Failed to save note history snapshot');
  }
}

/**
 * Hocuspocus extension class for note history snapshotting.
 */
export class NoteHistoryExtension implements Extension {
  priority = 50;
  extensionName = 'NoteHistory';

  /**
   * Called on every document change.
   * Only tracks dirty state and editor identity — no timers, no auto-snapshots.
   */
  async onChange(data: onChangePayload): Promise<void> {
    const parsed = parseDocName(data.documentName);
    if (!parsed) return;

    const state = getDocState(data.documentName);
    state.dirty = true;

    const email = (data.context as { user?: { email?: string } })?.user?.email;
    if (email) state.editors.add(email);
  }

  /**
   * Called when a client disconnects. If this was the last client,
   * save a disconnect snapshot.
   */
  async onDisconnect(data: onDisconnectPayload): Promise<void> {
    const parsed = parseDocName(data.documentName);
    if (!parsed) return;

    // clientsCount is the number of clients REMAINING after this disconnect
    if (data.clientsCount > 0) return;

    const state = getDocState(data.documentName);

    // Only snapshot if there were changes during this session
    if (!state.dirty) {
      docStates.delete(data.documentName);
      return;
    }

    const email = (data.context as { user?: { email?: string } })?.user?.email;
    const editors = Array.from(state.editors);
    const savedBy = email ?? editors[0] ?? 'system';

    await saveSnapshot(parsed.noteId, savedBy, editors, 'disconnect');

    // Clean up state for this document
    docStates.delete(data.documentName);
  }
}
