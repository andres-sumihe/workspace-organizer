/**
 * Team-scoped notes routes (nested under projects)
 *
 * All routes require team membership and respect RBAC permissions.
 * Notes are scoped to team projects via project_id.
 * Includes revision history for advanced changes tracking.
 */

import { Router } from 'express';

import { query, queryOne, execute } from '../../db/shared-client.js';
import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireTeamRole } from '../../middleware/team-rbac.middleware.js';
import { parsePaginationQuery } from '../../schemas/pagination.js';
import { auditService } from '../../services/audit.service.js';
import { teamEventsService } from '../../services/team-events.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

import type { TeamAuthenticatedRequest } from '../../middleware/team-rbac.middleware.js';
import type { RequestHandler, Response } from 'express';

export const teamNotesRouter = Router({ mergeParams: true });

teamNotesRouter.use(requireAuth as RequestHandler);

// Database row types
interface NoteRow {
  id: string;
  team_id: string;
  project_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_by_email: string;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
}

interface RevisionRow {
  id: string;
  note_id: string;
  title: string | null;
  content: string;
  saved_by_email: string;
  editors: string; // JSONB stored as string
  revision_number: number;
  snapshot_trigger: string;
  created_at: string;
}

const mapRevisionSummary = (row: RevisionRow) => {
  let editors: string[] = [];
  try {
    const parsed = typeof row.editors === 'string' ? JSON.parse(row.editors) : row.editors;
    if (Array.isArray(parsed)) editors = parsed;
  } catch { /* ignore */ }

  return {
    id: row.id,
    noteId: row.note_id,
    title: row.title ?? undefined,
    savedByEmail: row.saved_by_email,
    editors,
    revisionNumber: row.revision_number,
    snapshotTrigger: row.snapshot_trigger as 'auto' | 'disconnect' | 'manual' | 'session_end' | 'restore',
    createdAt: row.created_at,
  };
};

const mapRevisionFull = (row: RevisionRow) => ({
  ...mapRevisionSummary(row),
  content: row.content,
});

const mapNoteRow = (row: NoteRow) => ({
  id: row.id,
  teamId: row.team_id,
  projectId: row.project_id,
  title: row.title,
  content: row.content,
  isPinned: row.is_pinned,
  createdByEmail: row.created_by_email,
  updatedByEmail: row.updated_by_email ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

/**
 * Verify the project belongs to the team
 */
const verifyProject = async (projectId: string, teamId: string): Promise<void> => {
  const project = await queryOne<{ id: string }>(
    'SELECT id FROM team_projects WHERE id = $1 AND team_id = $2',
    [projectId, teamId]
  );
  if (!project) {
    throw new AppError('Team project not found', 404, 'TEAM_PROJECT_NOT_FOUND');
  }
};

/**
 * GET /teams/:teamId/projects/:projectId/notes
 * List notes for a team project
 */
teamNotesRouter.get('/', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId } = req;
  const projectId = req.params.projectId as string;
  const pagination = parsePaginationQuery(req.query);

  await verifyProject(projectId, teamId!);

  const searchQuery = typeof req.query.searchQuery === 'string' ? req.query.searchQuery : undefined;

  const conditions: string[] = ['project_id = $1', 'team_id = $2'];
  const values: unknown[] = [projectId, teamId];
  let paramIndex = 3;

  if (searchQuery && searchQuery.trim() !== '') {
    conditions.push(`(title ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`);
    values.push(`%${searchQuery}%`);
    paramIndex++;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(1) as count FROM team_notes ${whereClause}`,
    values
  );
  const total = countResult ? parseInt(countResult.count, 10) : 0;

  const limit = pagination.pageSize;
  const offset = (pagination.page - 1) * pagination.pageSize;
  values.push(limit, offset);

  const rows = await query<NoteRow>(
    `SELECT * FROM team_notes ${whereClause} ORDER BY is_pinned DESC, updated_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );

  res.json({
    items: rows.map(mapNoteRow),
    meta: {
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      hasNextPage: pagination.page * pagination.pageSize < total,
      hasPreviousPage: pagination.page > 1
    }
  });
}));

/**
 * GET /teams/:teamId/projects/:projectId/notes/:noteId
 * Get a specific note
 */
teamNotesRouter.get('/:noteId', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId } = req;
  const projectId = req.params.projectId as string;
  const { noteId } = req.params;

  await verifyProject(projectId, teamId!);

  const row = await queryOne<NoteRow>(
    'SELECT * FROM team_notes WHERE id = $1 AND project_id = $2 AND team_id = $3',
    [noteId, projectId, teamId]
  );

  if (!row) {
    throw new AppError('Team note not found', 404, 'TEAM_NOTE_NOT_FOUND');
  }

  res.json({ note: mapNoteRow(row) });
}));

/**
 * POST /teams/:teamId/projects/:projectId/notes
 * Create a new team note
 */
teamNotesRouter.post('/', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, memberEmail } = req;
  const projectId = req.params.projectId as string;
  const body = (req.body ?? {}) as Record<string, unknown>;

  await verifyProject(projectId, teamId!);

  const title = typeof body.title === 'string' ? body.title : undefined;
  const content = typeof body.content === 'string' ? body.content : '';
  const isPinned = typeof body.isPinned === 'boolean' ? body.isPinned : false;

  if (!title) {
    throw new AppError('Title is required', 400, 'INVALID_REQUEST');
  }

  const result = await query<NoteRow>(
    `INSERT INTO team_notes (team_id, project_id, title, content, is_pinned, created_by_email, updated_by_email)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     RETURNING *`,
    [teamId, projectId, title, content, isPinned, memberEmail]
  );

  const note = mapNoteRow(result[0]);

  await auditService.log({
    action: 'TEAM_NOTE_CREATE',
    teamId: teamId!,
    memberEmail: memberEmail!,
    memberDisplayName: req.user?.displayName,
    resourceType: 'team_note',
    resourceId: note.id,
    metadata: { title: note.title, projectId }
  });

  void teamEventsService.broadcast({ teamId: teamId!, resource: 'note', action: 'created', resourceId: note.id, parentId: projectId, actorEmail: memberEmail });

  res.status(201).json({ note });
}));

/**
 * PATCH /teams/:teamId/projects/:projectId/notes/:noteId
 * Update a team note (creates a revision for content changes)
 */
teamNotesRouter.patch('/:noteId', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, memberEmail } = req;
  const projectId = req.params.projectId as string;
  const { noteId } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;

  await verifyProject(projectId, teamId!);

  const existing = await queryOne<NoteRow>(
    'SELECT * FROM team_notes WHERE id = $1 AND project_id = $2 AND team_id = $3',
    [noteId, projectId, teamId]
  );

  if (!existing) {
    throw new AppError('Team note not found', 404, 'TEAM_NOTE_NOT_FOUND');
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (typeof body.title === 'string') { updates.push(`title = $${paramIndex++}`); values.push(body.title); }
  if (typeof body.content === 'string') { updates.push(`content = $${paramIndex++}`); values.push(body.content); }
  if (typeof body.isPinned === 'boolean') { updates.push(`is_pinned = $${paramIndex++}`); values.push(body.isPinned); }

  if (updates.length === 0) {
    res.json({ note: mapNoteRow(existing) });
    return;
  }

  updates.push(`updated_by_email = $${paramIndex++}`);
  values.push(memberEmail);
  values.push(noteId, projectId, teamId);

  const result = await query<NoteRow>(
    `UPDATE team_notes SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex++} AND project_id = $${paramIndex++} AND team_id = $${paramIndex} RETURNING *`,
    values
  );

  const note = mapNoteRow(result[0]);

  await auditService.log({
    action: 'TEAM_NOTE_UPDATE',
    teamId: teamId!,
    memberEmail: memberEmail!,
    memberDisplayName: req.user?.displayName,
    resourceType: 'team_note',
    resourceId: note.id,
    metadata: { title: note.title, projectId }
  });

  void teamEventsService.broadcast({ teamId: teamId!, resource: 'note', action: 'updated', resourceId: note.id, parentId: projectId, actorEmail: memberEmail });

  res.json({ note });
}));

/**
 * DELETE /teams/:teamId/projects/:projectId/notes/:noteId
 * Delete a team note (admin+ or creator)
 */
teamNotesRouter.delete('/:noteId', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, teamRole, memberEmail } = req;
  const projectId = req.params.projectId as string;
  const { noteId } = req.params;

  await verifyProject(projectId, teamId!);

  const existing = await queryOne<NoteRow>(
    'SELECT * FROM team_notes WHERE id = $1 AND project_id = $2 AND team_id = $3',
    [noteId, projectId, teamId]
  );

  if (!existing) {
    throw new AppError('Team note not found', 404, 'TEAM_NOTE_NOT_FOUND');
  }

  // Members can only delete their own notes
  if (teamRole === 'member' && existing.created_by_email !== memberEmail) {
    throw new AppError('You can only delete your own notes', 403, 'FORBIDDEN');
  }

  await execute(
    'DELETE FROM team_notes WHERE id = $1 AND project_id = $2 AND team_id = $3',
    [noteId, projectId, teamId]
  );

  await auditService.log({
    action: 'TEAM_NOTE_DELETE',
    teamId: teamId!,
    memberEmail: memberEmail!,
    memberDisplayName: req.user?.displayName,
    resourceType: 'team_note',
    resourceId: existing.id,
    metadata: { title: existing.title, projectId }
  });

  void teamEventsService.broadcast({ teamId: teamId!, resource: 'note', action: 'deleted', resourceId: existing.id, parentId: projectId, actorEmail: memberEmail });

  res.status(204).send();
}));

/**
 * GET /teams/:teamId/projects/:projectId/notes/:noteId/revisions
 * Get revision history for a note (summary — no content for performance)
 */
teamNotesRouter.get('/:noteId/revisions', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId } = req;
  const projectId = req.params.projectId as string;
  const { noteId } = req.params;

  await verifyProject(projectId, teamId!);

  // Verify note exists
  const note = await queryOne<{ id: string }>(
    'SELECT id FROM team_notes WHERE id = $1 AND project_id = $2 AND team_id = $3',
    [noteId, projectId, teamId]
  );

  if (!note) {
    throw new AppError('Team note not found', 404, 'TEAM_NOTE_NOT_FOUND');
  }

  const rows = await query<RevisionRow>(
    `SELECT id, note_id, title, saved_by_email, editors, revision_number, snapshot_trigger, created_at, '' as content
     FROM team_note_revisions WHERE note_id = $1 ORDER BY revision_number DESC`,
    [noteId]
  );

  res.json({ items: rows.map(mapRevisionSummary) });
}));

/**
 * GET /teams/:teamId/projects/:projectId/notes/:noteId/revisions/:revisionId
 * Get a single revision with full content (for preview)
 */
teamNotesRouter.get('/:noteId/revisions/:revisionId', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId } = req;
  const projectId = req.params.projectId as string;
  const { noteId, revisionId } = req.params;

  await verifyProject(projectId, teamId!);

  const row = await queryOne<RevisionRow>(
    'SELECT * FROM team_note_revisions WHERE id = $1 AND note_id = $2',
    [revisionId, noteId]
  );

  if (!row) {
    throw new AppError('Revision not found', 404, 'REVISION_NOT_FOUND');
  }

  res.json({ revision: mapRevisionFull(row) });
}));

/**
 * POST /teams/:teamId/projects/:projectId/notes/:noteId/revisions
 * Save a version snapshot of the current note content.
 * Accepts optional body.trigger ('manual' | 'session_end'). Defaults to 'manual'.
 * Skips creation if content is unchanged since the last revision.
 */
teamNotesRouter.post('/:noteId/revisions', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, memberEmail } = req;
  const projectId = req.params.projectId as string;
  const { noteId } = req.params;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const validTriggers = ['manual', 'session_end'] as const;
  const trigger = (typeof body.trigger === 'string' && (validTriggers as readonly string[]).includes(body.trigger))
    ? body.trigger as 'manual' | 'session_end'
    : 'manual';

  await verifyProject(projectId, teamId!);

  const note = await queryOne<NoteRow>(
    'SELECT * FROM team_notes WHERE id = $1 AND project_id = $2 AND team_id = $3',
    [noteId, projectId, teamId]
  );

  if (!note) {
    throw new AppError('Team note not found', 404, 'TEAM_NOTE_NOT_FOUND');
  }

  // Skip if content hasn't changed since the last revision
  const lastRev = await queryOne<{ revision_number: number; content: string }>(
    'SELECT revision_number, content FROM team_note_revisions WHERE note_id = $1 ORDER BY revision_number DESC LIMIT 1',
    [noteId]
  );

  if (lastRev && lastRev.content === note.content) {
    // No changes — return 200 with empty body instead of creating a duplicate
    res.status(200).json({ skipped: true });
    return;
  }

  const nextRevision = (lastRev?.revision_number ?? 0) + 1;

  const result = await query<RevisionRow>(
    `INSERT INTO team_note_revisions (note_id, title, content, saved_by_email, editors, revision_number, snapshot_trigger)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
     RETURNING *`,
    [noteId, note.title, note.content, memberEmail, JSON.stringify([memberEmail]), nextRevision, trigger]
  );

  res.status(201).json({ revision: mapRevisionFull(result[0]) });
}));

/**
 * POST /teams/:teamId/projects/:projectId/notes/:noteId/revisions/:revisionId/restore
 * Restore a previous revision (saves current state first as a "restore" snapshot)
 */
teamNotesRouter.post('/:noteId/revisions/:revisionId/restore', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const { teamId, memberEmail } = req;
  const projectId = req.params.projectId as string;
  const noteId = req.params.noteId as string;
  const revisionId = req.params.revisionId as string;

  await verifyProject(projectId, teamId!);

  const note = await queryOne<NoteRow>(
    'SELECT * FROM team_notes WHERE id = $1 AND project_id = $2 AND team_id = $3',
    [noteId, projectId, teamId]
  );

  if (!note) {
    throw new AppError('Team note not found', 404, 'TEAM_NOTE_NOT_FOUND');
  }

  const revision = await queryOne<RevisionRow>(
    'SELECT * FROM team_note_revisions WHERE id = $1 AND note_id = $2',
    [revisionId, noteId]
  );

  if (!revision) {
    throw new AppError('Revision not found', 404, 'REVISION_NOT_FOUND');
  }

  // Save current state as a "restore" snapshot before overwriting
  const lastRevision = await queryOne<{ revision_number: number }>(
    'SELECT MAX(revision_number) as revision_number FROM team_note_revisions WHERE note_id = $1',
    [noteId]
  );
  const nextRevision = (lastRevision?.revision_number ?? 0) + 1;

  await execute(
    `INSERT INTO team_note_revisions (note_id, title, content, saved_by_email, editors, revision_number, snapshot_trigger)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'restore')`,
    [noteId, note.title, note.content, memberEmail, JSON.stringify([memberEmail]), nextRevision]
  );

  // Apply the old revision's content to the note
  await execute(
    'UPDATE team_notes SET content = $1, updated_by_email = $2, updated_at = NOW() WHERE id = $3',
    [revision.content, memberEmail, noteId]
  );

  await auditService.log({
    action: 'TEAM_NOTE_RESTORE',
    teamId: teamId!,
    memberEmail: memberEmail as string,
    memberDisplayName: req.user?.displayName as string | undefined,
    resourceType: 'team_note',
    resourceId: noteId,
    metadata: {
      title: note.title,
      projectId,
      restoredRevisionId: revisionId,
      restoredRevisionNumber: revision.revision_number,
    }
  });

  void teamEventsService.broadcast({ teamId: teamId!, resource: 'note', action: 'updated', resourceId: noteId, parentId: projectId, actorEmail: memberEmail as string });

  const updated = await queryOne<NoteRow>(
    'SELECT * FROM team_notes WHERE id = $1',
    [noteId]
  );

  res.json({ note: mapNoteRow(updated ?? note) });
}));
