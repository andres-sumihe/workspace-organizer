

import { getDb } from '../db/client.js';
import { TemplatesService } from '../services/templates.service.js';
import { asyncHandler } from '../utils/async-handler.js';

import type { CreateTemplateInput, UpdateTemplateInput } from '@workspace/shared';
import type { Request, Response } from 'express';

export const listTemplates = asyncHandler(async (_req: Request, res: Response) => {
  const db = await getDb();
  const service = new TemplatesService(db);

  const templates = await service.listTemplates();

  res.json({ items: templates, meta: { total: templates.length } });
});

export const getTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { templateId } = req.params;
  const db = await getDb();
  const service = new TemplatesService(db);

  const template = await service.getTemplateById(templateId);

  res.json({ template });
});

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateTemplateInput;
  const db = await getDb();
  const service = new TemplatesService(db);

  const template = await service.createTemplate(input);

  res.status(201).json({ template });
});

export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { templateId } = req.params;
  const input = req.body as UpdateTemplateInput;
  const db = await getDb();
  const service = new TemplatesService(db);

  const template = await service.updateTemplate(templateId, input);

  res.json({ template });
});

export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { templateId } = req.params;
  const db = await getDb();
  const service = new TemplatesService(db);

  await service.deleteTemplate(templateId);

  res.status(204).send();
});

export const listWorkspaceTemplates = asyncHandler(async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const db = await getDb();
  const service = new TemplatesService(db);

  const templates = await service.listWorkspaceTemplates(workspaceId);

  res.json({ items: templates, meta: { total: templates.length } });
});

export const assignTemplateToWorkspace = asyncHandler(async (req: Request, res: Response) => {
  const { workspaceId, templateId } = req.params;
  const db = await getDb();
  const service = new TemplatesService(db);

  await service.assignTemplateToWorkspace(workspaceId, templateId);

  res.status(204).send();
});

export const unassignTemplateFromWorkspace = asyncHandler(async (req: Request, res: Response) => {
  const { workspaceId, templateId } = req.params;
  const db = await getDb();
  const service = new TemplatesService(db);

  await service.unassignTemplateFromWorkspace(workspaceId, templateId);

  res.status(204).send();
});
