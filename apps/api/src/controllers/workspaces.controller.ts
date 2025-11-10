import { v4 as uuidv4 } from 'uuid';

import { parsePaginationQuery } from '../schemas/pagination.js';
import {
  getWorkspaceList,
  createWorkspace as createWorkspaceService,
  getWorkspaceDetailById,
  updateWorkspace as updateWorkspaceService
} from '../services/workspaces.service.js';

import type { CreateWorkspaceInput } from '../repositories/workspaces.repository.js';
import type { RequestHandler } from 'express';

export const listWorkspacesHandler: RequestHandler = async (req, res) => {
  const pagination = parsePaginationQuery(req.query);

  const response = await getWorkspaceList({
    page: pagination.page,
    pageSize: pagination.pageSize
  });

  res.json(response);
};

export const createWorkspaceHandler: RequestHandler = async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const name = typeof body.name === 'string' ? body.name : undefined;
  const rootPath = typeof body.rootPath === 'string' ? body.rootPath : undefined;
  const description = typeof body.description === 'string' ? body.description : undefined;
  const settings = body.settings;
  const statistics = body.statistics;
  const status = typeof body.status === 'string' ? body.status : undefined;
  const lastIndexedAt = typeof body.lastIndexedAt === 'string' ? body.lastIndexedAt : undefined;

  if (!name || !rootPath) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'Missing required fields: name, rootPath' });
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  const input: CreateWorkspaceInput & { id: string; createdAt: string; updatedAt: string; status?: string; lastIndexedAt?: string } = {
    id,
    name,
    rootPath,
    description,
    settings,
    statistics,
    status,
    lastIndexedAt,
    createdAt: now,
    updatedAt: now
  };

  const workspace = await createWorkspaceService(input);

  res.status(201).json({ workspace });
};

export const getWorkspaceDetailHandler: RequestHandler = async (req, res) => {
  const workspaceId = req.params.workspaceId;
  if (!workspaceId) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'workspaceId is required' } });
  }

  const workspace = await getWorkspaceDetailById(workspaceId);
  res.json({ workspace });
};

export const updateWorkspaceHandler: RequestHandler = async (req, res) => {
  const workspaceId = req.params.workspaceId;
  if (!workspaceId) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'workspaceId is required' } });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const updates = {
    name: typeof body.name === 'string' ? body.name : undefined,
    rootPath: typeof body.rootPath === 'string' ? body.rootPath : undefined,
    description: typeof body.description === 'string' ? body.description : undefined
  };

  const workspace = await updateWorkspaceService(workspaceId, updates);
  res.json({ workspace });
};
