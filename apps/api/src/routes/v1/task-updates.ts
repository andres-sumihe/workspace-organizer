import { Router } from 'express';

import {
  listTaskUpdates,
  getTaskUpdate,
  createTaskUpdate,
  updateTaskUpdate,
  deleteTaskUpdate
} from '../../controllers/task-updates.controller.js';

export const taskUpdatesRouter = Router();

// List task updates for an entity
taskUpdatesRouter.get('/', listTaskUpdates);

// Get a single task update
taskUpdatesRouter.get('/:id', getTaskUpdate);

// Create a new task update
taskUpdatesRouter.post('/', createTaskUpdate);

// Update a task update
taskUpdatesRouter.put('/:id', updateTaskUpdate);

// Delete a task update
taskUpdatesRouter.delete('/:id', deleteTaskUpdate);
