import { parsePaginationQuery } from '../schemas/pagination.js';
import {
  getScriptList,
  getScriptDetailById,
  createScript as createScriptService,
  updateScript as updateScriptService,
  deleteScript as deleteScriptService,
  getStats,
  getDriveAnalysis,
  getConflicts,
  getAllTags,
  scanDirectory
} from '../services/scripts.service.js';

import type { ScriptType } from '@workspace/shared';
import type { RequestHandler } from 'express';

export const listScriptsHandler: RequestHandler = async (req, res) => {
  const pagination = parsePaginationQuery(req.query);

  const type = typeof req.query.type === 'string' ? (req.query.type as ScriptType) : undefined;
  const isActive =
    req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
  const driveLetter = typeof req.query.driveLetter === 'string' ? req.query.driveLetter : undefined;
  const tagId = typeof req.query.tagId === 'string' ? req.query.tagId : undefined;
  const searchQuery = typeof req.query.searchQuery === 'string' ? req.query.searchQuery : undefined;

  const response = await getScriptList({
    page: pagination.page,
    pageSize: pagination.pageSize,
    type,
    isActive,
    driveLetter,
    tagId,
    searchQuery
  });

  res.json(response);
};

export const getScriptDetailHandler: RequestHandler = async (req, res) => {
  const scriptId = req.params.scriptId;
  if (!scriptId) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'scriptId is required' } });
  }

  const script = await getScriptDetailById(scriptId);
  res.json({ script });
};

export const createScriptHandler: RequestHandler = async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const name = typeof body.name === 'string' ? body.name : undefined;
  const description = typeof body.description === 'string' ? body.description : undefined;
  const filePath = typeof body.filePath === 'string' ? body.filePath : undefined;
  const content = typeof body.content === 'string' ? body.content : undefined;
  const type = typeof body.type === 'string' ? (body.type as ScriptType) : 'batch';
  const isActive = typeof body.isActive === 'boolean' ? body.isActive : true;
  const tagIds = Array.isArray(body.tagIds) ? body.tagIds.filter((id): id is string => typeof id === 'string') : undefined;

  if (!name || !filePath || !content) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'Missing required fields: name, filePath, content' });
  }

  const script = await createScriptService({
    name,
    description,
    filePath,
    content,
    type,
    isActive,
    tagIds
  });

  res.status(201).json({ script });
};

export const updateScriptHandler: RequestHandler = async (req, res) => {
  const scriptId = req.params.scriptId;
  if (!scriptId) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'scriptId is required' } });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;

  const name = typeof body.name === 'string' ? body.name : undefined;
  const description = typeof body.description === 'string' ? body.description : undefined;
  const content = typeof body.content === 'string' ? body.content : undefined;
  const type = typeof body.type === 'string' ? (body.type as ScriptType) : undefined;
  const isActive = typeof body.isActive === 'boolean' ? body.isActive : undefined;
  const tagIds = Array.isArray(body.tagIds) ? body.tagIds.filter((id): id is string => typeof id === 'string') : undefined;

  const script = await updateScriptService(scriptId, {
    name,
    description,
    content,
    type,
    isActive,
    tagIds
  });

  res.json({ script });
};

export const deleteScriptHandler: RequestHandler = async (req, res) => {
  const scriptId = req.params.scriptId;
  if (!scriptId) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'scriptId is required' } });
  }

  await deleteScriptService(scriptId);
  res.status(204).send();
};

export const scanScriptsHandler: RequestHandler = async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const directoryPath = typeof body.directoryPath === 'string' ? body.directoryPath : undefined;
  const recursive = typeof body.recursive === 'boolean' ? body.recursive : false;
  const filePattern = typeof body.filePattern === 'string' ? body.filePattern : '*.bat';
  const replaceExisting = typeof body.replaceExisting === 'boolean' ? body.replaceExisting : false;

  if (!directoryPath) {
    return res.status(400).json({ code: 'INVALID_REQUEST', message: 'Missing required field: directoryPath' });
  }

  const scripts = await scanDirectory(directoryPath, recursive, filePattern, replaceExisting);
  res.json({ scripts, count: scripts.length });
};

export const getStatsHandler: RequestHandler = async (_req, res) => {
  const stats = await getStats();
  res.json({ stats });
};

export const getDriveAnalysisHandler: RequestHandler = async (_req, res) => {
  const analysis = await getDriveAnalysis();
  res.json({ analysis });
};

export const getConflictsHandler: RequestHandler = async (_req, res) => {
  const conflicts = await getConflicts();
  res.json({ conflicts });
};

export const listTagsHandler: RequestHandler = async (_req, res) => {
  const tags = await getAllTags();
  res.json({ tags });
};
