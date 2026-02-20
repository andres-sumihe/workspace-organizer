import { randomUUID } from 'crypto';

import { taskUpdatesRepository } from '../repositories/task-updates.repository.js';
import { extractImageFilenames, deleteUploadedImages } from '../controllers/uploads.controller.js';

import type {
  TaskUpdate,
  TaskUpdateEntityType,
  CreateTaskUpdateRequest,
  UpdateTaskUpdateRequest
} from '@workspace/shared';

export const taskUpdatesService = {
  /**
   * Create a new task update
   */
  async create(request: CreateTaskUpdateRequest): Promise<TaskUpdate> {
    const id = randomUUID();

    return taskUpdatesRepository.create({
      id,
      entityType: request.entityType,
      entityId: request.entityId,
      parentId: request.parentId,
      content: request.content
    });
  },

  /**
   * Get a task update by ID
   */
  async getById(id: string): Promise<TaskUpdate | null> {
    return taskUpdatesRepository.getById(id);
  },

  /**
   * List task updates for an entity
   */
  async listByEntity(entityType: TaskUpdateEntityType, entityId: string): Promise<TaskUpdate[]> {
    return taskUpdatesRepository.listByEntity(entityType, entityId);
  },

  /**
   * Update a task update. Cleans up images that were in the old content but
   * are no longer referenced in the new content.
   */
  async update(id: string, request: UpdateTaskUpdateRequest): Promise<TaskUpdate> {
    const existing = await taskUpdatesRepository.getById(id);
    if (!existing) {
      throw new Error(`Task update with ID "${id}" not found`);
    }

    // Determine which images were removed from the content
    const oldImages = new Set(extractImageFilenames(existing.content));
    const newImages = new Set(extractImageFilenames(request.content));
    const removedImages = [...oldImages].filter((f) => !newImages.has(f));
    if (removedImages.length > 0) {
      deleteUploadedImages(removedImages).catch(() => {});
    }

    const updated = await taskUpdatesRepository.update(id, {
      content: request.content
    });

    if (!updated) {
      throw new Error(`Failed to update task update with ID "${id}"`);
    }

    return updated;
  },

  /**
   * Delete a task update and clean up any uploaded images in its content.
   */
  async delete(id: string): Promise<boolean> {
    const existing = await taskUpdatesRepository.getById(id);
    if (existing) {
      const filenames = extractImageFilenames(existing.content);
      if (filenames.length > 0) {
        deleteUploadedImages(filenames).catch(() => {});
      }
    }
    return taskUpdatesRepository.delete(id);
  },

  /**
   * Delete all updates for an entity and clean up any uploaded images.
   */
  async deleteByEntity(entityType: TaskUpdateEntityType, entityId: string): Promise<number> {
    const updates = await taskUpdatesRepository.listByEntity(entityType, entityId);
    const allFilenames = updates.flatMap((u) => extractImageFilenames(u.content));
    if (allFilenames.length > 0) {
      deleteUploadedImages(allFilenames).catch(() => {});
    }
    return taskUpdatesRepository.deleteByEntity(entityType, entityId);
  }
};
