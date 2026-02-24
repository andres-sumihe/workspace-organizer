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
  content: string;
  saved_by_email: string;
  revision_number: number;
  created_at: string;
}

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

const mapRevisionRow = (row: RevisionRow) => ({
  id: row.id,
  noteId: row.note_id,
  content: row.content,
  savedByEmail: row.saved_by_email,
  revisionNumber: row.revision_number,
  createdAt: row.created_at
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

  // If content is changing, save a revision of the OLD content
  if (typeof body.content === 'string' && body.content !== existing.content) {
    const lastRevision = await queryOne<{ revision_number: number }>(
      'SELECT MAX(revision_number) as revision_number FROM team_note_revisions WHERE note_id = $1',
      [noteId]
    );
    const nextRevision = (lastRevision?.revision_number ?? 0) + 1;

    await execute(
      `INSERT INTO team_note_revisions (note_id, content, saved_by_email, revision_number)
       VALUES ($1, $2, $3, $4)`,
      [noteId, existing.content, memberEmail, nextRevision]
    );
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

  res.status(204).send();
}));

/**
 * GET /teams/:teamId/projects/:projectId/notes/:noteId/revisions
 * Get revision history for a note
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
    'SELECT * FROM team_note_revisions WHERE note_id = $1 ORDER BY revision_number DESC',
    [noteId]
  );

  res.json({ items: rows.map(mapRevisionRow) });
}));
