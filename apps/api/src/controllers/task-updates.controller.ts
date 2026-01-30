import type { Request, Response, NextFunction } from 'express';

import { taskUpdatesService } from '../services/task-updates.service.js';

import type { TaskUpdateEntityType, CreateTaskUpdateRequest, UpdateTaskUpdateRequest } from '@workspace/shared';

/**
 * List task updates for an entity
 * GET /api/v1/task-updates?entityType=work_log&entityId=xxx
 */
export const listTaskUpdates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entityType = req.query.entityType as TaskUpdateEntityType | undefined;
    const entityId = req.query.entityId as string | undefined;

    if (!entityType || !entityId) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'entityType and entityId are required query parameters'
      });
      return;
    }

    if (!['work_log', 'personal_project'].includes(entityType)) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'entityType must be "work_log" or "personal_project"'
      });
      return;
    }

    const items = await taskUpdatesService.listByEntity(entityType, entityId);
    res.json({ items });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a task update by ID
 * GET /api/v1/task-updates/:id
 */
export const getTaskUpdate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const update = await taskUpdatesService.getById(id);

    if (!update) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Task update not found'
      });
      return;
    }

    res.json({ update });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new task update
 * POST /api/v1/task-updates
 */
export const createTaskUpdate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as CreateTaskUpdateRequest;

    if (!body.entityType || !body.entityId || !body.content) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'entityType, entityId, and content are required'
      });
      return;
    }

    if (!['work_log', 'personal_project'].includes(body.entityType)) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'entityType must be "work_log" or "personal_project"'
      });
      return;
    }

    const update = await taskUpdatesService.create(body);
    res.status(201).json({ update });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a task update
 * PUT /api/v1/task-updates/:id
 */
export const updateTaskUpdate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const body = req.body as UpdateTaskUpdateRequest;

    if (!body.content) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'content is required'
      });
      return;
    }

    const update = await taskUpdatesService.update(id, body);
    res.json({ update });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: error.message
      });
      return;
    }
    next(error);
  }
};

/**
 * Delete a task update
 * DELETE /api/v1/task-updates/:id
 */
export const deleteTaskUpdate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const deleted = await taskUpdatesService.delete(id);

    if (!deleted) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Task update not found'
      });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
