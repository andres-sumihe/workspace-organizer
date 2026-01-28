import { Router } from 'express';

import {
  listProjects,
  getProject,
  getProjectDetail,
  createProject,
  updateProject,
  deleteProject,
  searchProjects
} from '../../controllers/personal-projects.controller.js';

export const personalProjectsRouter = Router();

// Search must come before :id to avoid conflict
personalProjectsRouter.get('/search', searchProjects);

personalProjectsRouter.get('/', listProjects);
personalProjectsRouter.get('/:id', getProject);
personalProjectsRouter.get('/:id/detail', getProjectDetail);
personalProjectsRouter.post('/', createProject);
personalProjectsRouter.put('/:id', updateProject);
personalProjectsRouter.delete('/:id', deleteProject);
