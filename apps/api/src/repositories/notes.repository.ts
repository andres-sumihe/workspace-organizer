import { getDb } from '../db/client.js';

import type { Note, PersonalProject } from '@workspace/shared';

interface NoteRow {
  id: string;
  title: string;
  content: string;
  is_pinned: number;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined project fields
  project_title?: string | null;
  project_status?: string | null;
}

const isNoteRow = (value: unknown): value is NoteRow => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.created_at === 'string' &&
    typeof candidate.updated_at === 'string'
  );
};

const mapRowToNote = (row: NoteRow): Note => ({
  id: row.id,
  title: row.title,
  content: row.content ?? '',
  isPinned: row.is_pinned === 1,
  projectId: row.project_id ?? undefined,
  project: row.project_title
    ? ({
        id: row.project_id!,
        title: row.project_title,
        status: row.project_status ?? 'active'
      } as PersonalProject)
    : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export interface CreateNoteData {
  id: string;
  title: string;
  content?: string;
  isPinned?: boolean;
  projectId?: string;
}

export interface UpdateNoteData {
  title?: string;
  content?: string;
  isPinned?: boolean;
  projectId?: string | null;
}

export interface ListNotesParams {
  projectId?: string;
  search?: string;
}

export const notesRepository = {
  /**
   * Create a new note
   */
  async create(data: CreateNoteData): Promise<Note> {
    const db = await getDb();

    db.prepare(
      `INSERT INTO notes (id, title, content, is_pinned, project_id)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      data.id,
      data.title,
      data.content ?? '',
      data.isPinned ? 1 : 0,
      data.projectId ?? null
    );

    const note = await this.getById(data.id);
    if (!note) throw new Error(`Failed to retrieve note after insert: ${data.id}`);
    return note;
  },

  /**
   * Get note by ID with project info
   */
  async getById(id: string): Promise<Note | null> {
    const db = await getDb();
    const row = db
      .prepare(
        `SELECT n.*, p.title as project_title, p.status as project_status
         FROM notes n
         LEFT JOIN personal_projects p ON n.project_id = p.id
         WHERE n.id = ?`
      )
      .get(id);
    if (!isNoteRow(row)) return null;
    return mapRowToNote(row);
  },

  /**
   * List notes with optional filters
   */
  async list(params: ListNotesParams = {}): Promise<Note[]> {
    const db = await getDb();

    let query = `
      SELECT n.*, p.title as project_title, p.status as project_status
      FROM notes n
      LEFT JOIN personal_projects p ON n.project_id = p.id
      WHERE 1=1
    `;
    const queryParams: (string | number)[] = [];

    if (params.projectId) {
      query += ' AND n.project_id = ?';
      queryParams.push(params.projectId);
    }

    if (params.search) {
      query += ' AND (n.title LIKE ? OR n.content LIKE ?)';
      const searchPattern = `%${params.search}%`;
      queryParams.push(searchPattern, searchPattern);
    }

    query += ' ORDER BY n.is_pinned DESC, n.updated_at DESC';

    const rows = db.prepare(query).all(...queryParams) as unknown[];
    return rows.filter(isNoteRow).map(mapRowToNote);
  },

  /**
   * Update a note by ID
   */
  async update(id: string, data: UpdateNoteData): Promise<Note | null> {
    const db = await getDb();

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.content !== undefined) {
      updates.push('content = ?');
      params.push(data.content);
    }
    if (data.isPinned !== undefined) {
      updates.push('is_pinned = ?');
      params.push(data.isPinned ? 1 : 0);
    }
    if (data.projectId !== undefined) {
      updates.push('project_id = ?');
      params.push(data.projectId);
    }

    if (updates.length === 0) {
      return this.getById(id);
    }

    params.push(id);
    db.prepare(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    return this.getById(id);
  },

  /**
   * Delete a note by ID
   * Returns true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    const db = await getDb();
    const result = db.prepare('DELETE FROM notes WHERE id = ?').run(id);
    return result.changes > 0;
  },

  /**
   * Search notes by title or content
   */
  async search(query: string, limit = 20): Promise<Note[]> {
    const db = await getDb();
    const searchPattern = `%${query}%`;
    const rows = db
      .prepare(
        `SELECT n.*, p.title as project_title, p.status as project_status
         FROM notes n
         LEFT JOIN personal_projects p ON n.project_id = p.id
         WHERE n.title LIKE ? OR n.content LIKE ?
         ORDER BY n.is_pinned DESC, n.updated_at DESC
         LIMIT ?`
      )
      .all(searchPattern, searchPattern, limit) as unknown[];
    return rows.filter(isNoteRow).map(mapRowToNote);
  }
};
