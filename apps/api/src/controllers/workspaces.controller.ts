import { parsePaginationQuery } from '../schemas/pagination.js';
import { getWorkspaceList, createWorkspace as createWorkspaceService } from '../services/workspaces.service.js';

import type { RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const listWorkspacesHandler: RequestHandler = async (req, res) => {
  const pagination = parsePaginationQuery(req.query);

  const response = await getWorkspaceList({
    page: pagination.page,
    pageSize: pagination.pageSize
  });

  res.json(response);
};

export const createWorkspaceHandler: RequestHandler = async (req, res) => {
  const body = req.body ?? {};

  const { name, application, rootPath, description, settings, statistics, status, lastIndexedAt } = body;

  if (!name || !application || !rootPath) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'Missing required fields: name, application, rootPath' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  const workspace = await createWorkspaceService({
    id,
    name,
    application,
    rootPath,
    description,
    settings,
    statistics,
    status,
    lastIndexedAt,
    createdAt: now,
    updatedAt: now
  } as any);

  res.status(201).json({ workspace });
};
