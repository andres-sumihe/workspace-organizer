import { randomUUID } from 'node:crypto';

import { tagsRepository, type CreateTagData, type UpdateTagData } from '../repositories/tags.repository.js';

import type { Tag, CreateTagRequest, UpdateTagRequest } from '@workspace/shared';

export const tagsService = {
  /**
   * Create a new tag
   * @throws Error if tag name already exists
   */
  async create(request: CreateTagRequest): Promise<Tag> {
    // Check if tag name already exists
    const existing = await tagsRepository.getByName(request.name);
    if (existing) {
      throw new Error(`Tag with name "${request.name}" already exists`);
    }

    const data: CreateTagData = {
      id: randomUUID(),
      name: request.name.trim(),
      color: request.color
    };

    return tagsRepository.create(data);
  },

  /**
   * Get tag by ID
   */
  async getById(id: string): Promise<Tag | null> {
    return tagsRepository.getById(id);
  },

  /**
   * Get tag by name
   */
  async getByName(name: string): Promise<Tag | null> {
    return tagsRepository.getByName(name);
  },

  /**
   * List all tags
   */
  async list(): Promise<Tag[]> {
    return tagsRepository.list();
  },

  /**
   * Update a tag
   * @throws Error if tag not found
   * @throws Error if new name already exists
   */
  async update(id: string, request: UpdateTagRequest): Promise<Tag> {
    const existing = await tagsRepository.getById(id);
    if (!existing) {
      throw new Error(`Tag with ID "${id}" not found`);
    }

    // If name is being changed, check for conflicts
    if (request.name && request.name !== existing.name) {
      const conflict = await tagsRepository.getByName(request.name);
      if (conflict && conflict.id !== id) {
        throw new Error(`Tag with name "${request.name}" already exists`);
      }
    }

    const data: UpdateTagData = {};
    if (request.name !== undefined) data.name = request.name.trim();
    if (request.color !== undefined) data.color = request.color;

    const updated = await tagsRepository.update(id, data);
    if (!updated) {
      throw new Error(`Failed to update tag with ID "${id}"`);
    }

    return updated;
  },

  /**
   * Delete a tag
   * Returns true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    return tagsRepository.delete(id);
  },

  /**
   * Get or create a tag by name
   * Useful for auto-creating tags from hashtags in content
   */
  async getOrCreate(name: string, color?: string): Promise<Tag> {
    const existing = await tagsRepository.getByName(name);
    if (existing) {
      return existing;
    }

    return this.create({ name, color });
  },

  /**
   * Search tags by name prefix (for autocomplete)
   */
  async search(query: string, limit = 10): Promise<Tag[]> {
    return tagsRepository.searchByName(query, limit);
  },

  /**
   * Get tags by IDs
   */
  async getByIds(ids: string[]): Promise<Tag[]> {
    return tagsRepository.getByIds(ids);
  }
};
