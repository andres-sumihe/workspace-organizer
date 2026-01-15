import { personalProjectsService } from '../services/personal-projects.service.js';

import type {
  CreatePersonalProjectRequest,
  UpdatePersonalProjectRequest,
  PersonalProjectStatus
} from '@workspace/shared';
import type { Request, Response, NextFunction } from 'express';

/**
 * List personal projects
 * GET /api/v1/personal-projects
 */
export const listProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.query.workspaceId as string | undefined;
    const statusParam = req.query.status as string | string[] | undefined;
    const tagIdsParam = req.query.tagIds as string | string[] | undefined;

    // Parse status array
    let status: PersonalProjectStatus[] | undefined;
    if (statusParam) {
      status = (Array.isArray(statusParam) ? statusParam : [statusParam]) as PersonalProjectStatus[];
    }

    // Parse tagIds array
    let tagIds: string[] | undefined;
    if (tagIdsParam) {
      tagIds = Array.isArray(tagIdsParam) ? tagIdsParam : [tagIdsParam];
    }

    const projects = await personalProjectsService.list({ workspaceId, status, tagIds });

    res.json({ items: projects });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single project by ID (basic)
 * GET /api/v1/personal-projects/:id
 */
export const getProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await personalProjectsService.getById(id);

    if (!project) {
      return res.status(404).json({
        code: 'PROJECT_NOT_FOUND',
        message: 'Personal project not found'
      });
    }

    res.json({ project });
  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed project information (with linked tasks and workspace)
 * GET /api/v1/personal-projects/:id/detail
 */
export const getProjectDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await personalProjectsService.getDetail(id);

    if (!project) {
      return res.status(404).json({
        code: 'PROJECT_NOT_FOUND',
        message: 'Personal project not found'
      });
    }

    res.json({ project });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new project
 * POST /api/v1/personal-projects
 */
export const createProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as CreatePersonalProjectRequest;

    if (!data.title?.trim()) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Title is required'
      });
    }

    const project = await personalProjectsService.create(data);

    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing project
 * PUT /api/v1/personal-projects/:id
 */
export const updateProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = req.body as UpdatePersonalProjectRequest;

    const project = await personalProjectsService.update(id, data);

    if (!project) {
      return res.status(404).json({
        code: 'PROJECT_NOT_FOUND',
        message: 'Personal project not found'
      });
    }

    res.json({ project });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a project
 * DELETE /api/v1/personal-projects/:id
 */
export const deleteProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deleted = await personalProjectsService.delete(id);

    if (!deleted) {
      return res.status(404).json({
        code: 'PROJECT_NOT_FOUND',
        message: 'Personal project not found'
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Search projects by title
 * GET /api/v1/personal-projects/search
 */
export const searchProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q as string | undefined;

    if (!query?.trim()) {
      return res.json({ items: [] });
    }

    const projects = await personalProjectsService.search(query);

    res.json({ items: projects });
  } catch (error) {
    next(error);
  }
};
