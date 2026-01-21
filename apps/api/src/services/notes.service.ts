import { randomUUID } from 'node:crypto';

import { notesRepository, type CreateNoteData, type UpdateNoteData, type ListNotesParams } from '../repositories/notes.repository.js';

import type { Note, CreateNoteRequest, UpdateNoteRequest } from '@workspace/shared';

export const notesService = {
  /**
   * Create a new note
   */
  async create(request: CreateNoteRequest): Promise<Note> {
    const data: CreateNoteData = {
      id: randomUUID(),
      title: request.title.trim(),
      content: request.content ?? '',
      isPinned: request.isPinned ?? false,
      projectId: request.projectId
    };

    return notesRepository.create(data);
  },

  /**
   * Get note by ID
   */
  async getById(id: string): Promise<Note | null> {
    return notesRepository.getById(id);
  },

  /**
   * List notes with optional filters
   */
  async list(params: ListNotesParams = {}): Promise<Note[]> {
    return notesRepository.list(params);
  },

  /**
   * Update a note
   * @throws Error if note not found
   */
  async update(id: string, request: UpdateNoteRequest): Promise<Note> {
    const existing = await notesRepository.getById(id);
    if (!existing) {
      throw new Error(`Note with ID "${id}" not found`);
    }

    const data: UpdateNoteData = {};
    if (request.title !== undefined) data.title = request.title.trim();
    if (request.content !== undefined) data.content = request.content;
    if (request.isPinned !== undefined) data.isPinned = request.isPinned;
    if (request.projectId !== undefined) data.projectId = request.projectId;

    const updated = await notesRepository.update(id, data);
    if (!updated) {
      throw new Error(`Failed to update note with ID "${id}"`);
    }

    return updated;
  },

  /**
   * Delete a note
   * Returns true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    return notesRepository.delete(id);
  },

  /**
   * Search notes by title or content
   */
  async search(query: string, limit = 20): Promise<Note[]> {
    return notesRepository.search(query, limit);
  }
};
