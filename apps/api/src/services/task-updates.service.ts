import { randomUUID } from 'crypto';

import { taskUpdatesRepository } from '../repositories/task-updates.repository.js';

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
   * Update a task update
   */
  async update(id: string, request: UpdateTaskUpdateRequest): Promise<TaskUpdate> {
    const existing = await taskUpdatesRepository.getById(id);
    if (!existing) {
      throw new Error(`Task update with ID "${id}" not found`);
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
   * Delete a task update
   */
  async delete(id: string): Promise<boolean> {
    return taskUpdatesRepository.delete(id);
  },

  /**
   * Delete all updates for an entity
   */
  async deleteByEntity(entityType: TaskUpdateEntityType, entityId: string): Promise<number> {
    return taskUpdatesRepository.deleteByEntity(entityType, entityId);
  }
};
