import { randomUUID } from 'node:crypto';

import { tagsService } from './tags.service.js';
import {
  workLogsRepository,
  type CreateWorkLogData,
  type UpdateWorkLogData,
  type ListWorkLogsParams
} from '../repositories/work-logs.repository.js';

import type {
  WorkLogEntry,
  CreateWorkLogRequest,
  UpdateWorkLogRequest,
  RolloverWorkLogsRequest,
  RolloverWorkLogsResponse
} from '@workspace/shared';

/**
 * Get today's date in YYYY-MM-DD format
 */
const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const workLogsService = {
  /**
   * Create a new work log entry
   */
  async create(request: CreateWorkLogRequest): Promise<WorkLogEntry> {
    const data: CreateWorkLogData = {
      id: randomUUID(),
      date: request.date,
      content: request.content,
      status: request.status ?? 'todo',
      priority: request.priority,
      startDate: request.startDate,
      dueDate: request.dueDate,
      projectId: request.projectId,
      flags: request.flags
    };

    const entry = await workLogsRepository.create(data);

    // Sync tags if provided
    if (request.tagIds && request.tagIds.length > 0) {
      // Validate that all tag IDs exist
      const tags = await tagsService.getByIds(request.tagIds);
      const validTagIds = tags.map((t) => t.id);
      await workLogsRepository.syncTags(entry.id, validTagIds, randomUUID);

      // Re-fetch to get the entry with tags
      const updatedEntry = await workLogsRepository.getById(entry.id);
      if (updatedEntry) return updatedEntry;
    }

    return entry;
  },

  /**
   * Get work log entry by ID
   */
  async getById(id: string): Promise<WorkLogEntry | null> {
    return workLogsRepository.getById(id);
  },

  /**
   * List work logs with optional filters
   */
  async list(params: ListWorkLogsParams = {}): Promise<WorkLogEntry[]> {
    return workLogsRepository.list(params);
  },

  /**
   * Update a work log entry
   * @throws Error if entry not found
   */
  async update(id: string, request: UpdateWorkLogRequest): Promise<WorkLogEntry> {
    const existing = await workLogsRepository.getById(id);
    if (!existing) {
      throw new Error(`Work log with ID "${id}" not found`);
    }

    const data: UpdateWorkLogData = {};
    if (request.date !== undefined) data.date = request.date;
    if (request.content !== undefined) data.content = request.content;
    if (request.status !== undefined) data.status = request.status;
    if (request.priority !== undefined) data.priority = request.priority;
    if (request.startDate !== undefined) data.startDate = request.startDate;
    if (request.dueDate !== undefined) data.dueDate = request.dueDate;
    if (request.actualEndDate !== undefined) data.actualEndDate = request.actualEndDate;
    if (request.projectId !== undefined) data.projectId = request.projectId;
    if (request.flags !== undefined) data.flags = request.flags;

    // Update entry fields
    await workLogsRepository.update(id, data);

    // Sync tags if provided
    if (request.tagIds !== undefined) {
      // Validate that all tag IDs exist
      const tags = await tagsService.getByIds(request.tagIds);
      const validTagIds = tags.map((t) => t.id);
      await workLogsRepository.syncTags(id, validTagIds, randomUUID);
    }

    const updated = await workLogsRepository.getById(id);
    if (!updated) {
      throw new Error(`Failed to retrieve work log after update: ${id}`);
    }

    return updated;
  },

  /**
   * Delete a work log entry
   * Returns true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    return workLogsRepository.delete(id);
  },

  /**
   * Rollover unfinished work logs from a source date to a target date
   */
  async rollover(request: RolloverWorkLogsRequest): Promise<RolloverWorkLogsResponse> {
    const toDate = request.toDate ?? getTodayDate();

    // Get unfinished entries from the source date
    const unfinished = await workLogsRepository.getUnfinishedByDate(request.fromDate);

    if (unfinished.length === 0) {
      return { rolledOverCount: 0, items: [] };
    }

    if (request.mode === 'move') {
      // Move: Update the date of existing entries
      const ids = unfinished.map((e) => e.id);
      await workLogsRepository.bulkUpdateDate(ids, toDate);

      // Re-fetch the moved entries
      const movedEntries = await Promise.all(ids.map((id) => workLogsRepository.getById(id)));
      const validEntries = movedEntries.filter((e): e is WorkLogEntry => e !== null);

      return { rolledOverCount: validEntries.length, items: validEntries };
    } else {
      // Copy: Create new entries with the target date
      const copiedEntries: WorkLogEntry[] = [];

      for (const entry of unfinished) {
        const newEntry = await workLogsRepository.create({
          id: randomUUID(),
          date: toDate,
          content: entry.content,
          status: entry.status,
          priority: entry.priority,
          startDate: entry.startDate,
          dueDate: entry.dueDate,
          projectId: entry.projectId
        });

        // Copy tags
        if (entry.tags.length > 0) {
          const tagIds = entry.tags.map((t) => t.id);
          await workLogsRepository.syncTags(newEntry.id, tagIds, randomUUID);
        }

        const entryWithTags = await workLogsRepository.getById(newEntry.id);
        if (entryWithTags) {
          copiedEntries.push(entryWithTags);
        }
      }

      return { rolledOverCount: copiedEntries.length, items: copiedEntries };
    }
  },

  /**
   * Get work logs for a specific week
   * @param weekStartDate - The Monday of the week (YYYY-MM-DD)
   */
  async getWeekLogs(weekStartDate: string): Promise<WorkLogEntry[]> {
    // Calculate week end (Sunday)
    const start = new Date(weekStartDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const weekEndDate = end.toISOString().split('T')[0];

    return this.list({ from: weekStartDate, to: weekEndDate });
  }
};
