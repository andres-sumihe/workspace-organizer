import { Router } from 'express';

import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  searchProjects
} from '../controllers/personal-projects.controller.js';

const router = Router();

// Search must come before :id to avoid conflict
router.get('/search', searchProjects);

router.get('/', listProjects);
router.get('/:id', getProject);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

export default router;
