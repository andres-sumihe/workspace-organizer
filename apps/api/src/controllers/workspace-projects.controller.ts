import { createWorkspaceProject, listWorkspaceProjects } from '../services/projects.service.js';

import type { RequestHandler } from 'express';

export const listWorkspaceProjectsHandler: RequestHandler = async (req, res) => {
  const workspaceId = req.params.workspaceId;
  if (!workspaceId) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'workspaceId is required' } });
  }

  const projects = await listWorkspaceProjects(workspaceId);
  res.json({ projects });
};

export const createWorkspaceProjectHandler: RequestHandler = async (req, res) => {
  const workspaceId = req.params.workspaceId;
  if (!workspaceId) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'workspaceId is required' } });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const payload = {
    name: typeof body.name === 'string' ? body.name : undefined,
    relativePath: typeof body.relativePath === 'string' ? body.relativePath : undefined,
    description: typeof body.description === 'string' ? body.description : undefined
  };

  const project = await createWorkspaceProject(workspaceId, payload);
  res.status(201).json({ project });
};
