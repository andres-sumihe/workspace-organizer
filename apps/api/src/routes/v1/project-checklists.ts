import { Router } from 'express';

import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { projectChecklistService } from '../../services/project-checklist.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import type {
  ChecklistItemStatus,
  CreateProjectChecklistItemRequest,
  GenerateProjectChecklistRequest,
  UpdateProjectChecklistItemRequest,
} from '@workspace/shared';
import type { RequestHandler, Response } from 'express';

export const projectChecklistsRouter = Router({ mergeParams: true });

const allowedStatuses = new Set<ChecklistItemStatus>([
  'pending',
  'in_progress',
  'completed',
  'blocked',
  'not_applicable',
]);

const getParam = (value: string | string[] | undefined, name: string): string => {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  throw new AppError(`${name} is required`, 400, 'VALIDATION_ERROR');
};

const makeContentDisposition = (filename: string): string => {
  const safeFilename = filename.replace(/["\\\r\n]/g, '_');
  return `attachment; filename="${safeFilename}"`;
};

const optionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const nullableText = (value: unknown): string | null | undefined => {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseGenerateBody = (body: unknown): GenerateProjectChecklistRequest => {
  const data = (body ?? {}) as Record<string, unknown>;
  return {
    templateId: optionalText(data.templateId),
    templateVersionId: optionalText(data.templateVersionId),
    title: optionalText(data.title),
    overwrite: data.overwrite === true,
  };
};

const parseUpdateBody = (body: unknown): UpdateProjectChecklistItemRequest => {
  const data = (body ?? {}) as Record<string, unknown>;
  const input: UpdateProjectChecklistItemRequest = {};

  if ('title' in data) {
    const title = optionalText(data.title);
    if (!title) throw new AppError('Checklist item title cannot be empty', 400, 'VALIDATION_ERROR');
    input.title = title;
  }
  if ('description' in data) input.description = nullableText(data.description);
  if ('groupTitle' in data) input.groupTitle = nullableText(data.groupTitle);
  if ('plannedDate' in data) input.plannedDate = nullableText(data.plannedDate);
  if ('plannedTime' in data) input.plannedTime = nullableText(data.plannedTime);
  if ('location' in data) input.location = nullableText(data.location);
  if ('pic' in data) input.pic = nullableText(data.pic);
  if ('owner' in data) input.owner = nullableText(data.owner);
  if ('notes' in data) input.notes = nullableText(data.notes);
  if ('evidenceUrl' in data) input.evidenceUrl = nullableText(data.evidenceUrl);
  if ('status' in data) {
    if (typeof data.status !== 'string' || !allowedStatuses.has(data.status as ChecklistItemStatus)) {
      throw new AppError('Invalid checklist item status', 400, 'VALIDATION_ERROR');
    }
    input.status = data.status as ChecklistItemStatus;
  }

  return input;
};

const parseCreateBody = (body: unknown): CreateProjectChecklistItemRequest => {
  const data = (body ?? {}) as Record<string, unknown>;
  const sectionId = optionalText(data.sectionId);
  if (!sectionId) throw new AppError('Checklist section is required', 400, 'VALIDATION_ERROR');

  const input: CreateProjectChecklistItemRequest = {
    sectionId,
    title: optionalText(data.title) ?? '',
  };

  if ('description' in data) input.description = nullableText(data.description);
  if ('groupTitle' in data) input.groupTitle = nullableText(data.groupTitle);
  if ('plannedDate' in data) input.plannedDate = nullableText(data.plannedDate);
  if ('plannedTime' in data) input.plannedTime = nullableText(data.plannedTime);
  if ('location' in data) input.location = nullableText(data.location);
  if ('pic' in data) input.pic = nullableText(data.pic);
  if ('status' in data) {
    if (typeof data.status !== 'string' || !allowedStatuses.has(data.status as ChecklistItemStatus)) {
      throw new AppError('Invalid checklist item status', 400, 'VALIDATION_ERROR');
    }
    input.status = data.status as ChecklistItemStatus;
  }

  return input;
};

projectChecklistsRouter.use(requireAuth as RequestHandler);

projectChecklistsRouter.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const projectId = getParam(req.params.projectId, 'Project ID');
  const checklist = await projectChecklistService.getLocal(projectId);
  res.json({ checklist });
}));

projectChecklistsRouter.post('/generate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const projectId = getParam(req.params.projectId, 'Project ID');
  const body = parseGenerateBody(req.body);
  const checklist = await projectChecklistService.generateLocal({
    projectId,
    templateId: body.templateId,
    templateVersionId: body.templateVersionId,
    title: body.title,
    overwrite: body.overwrite,
    createdByEmail: req.user?.email,
  });
  res.status(201).json({ checklist });
}));

projectChecklistsRouter.patch('/items/:itemId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const projectId = getParam(req.params.projectId, 'Project ID');
  const itemId = getParam(req.params.itemId, 'Checklist item ID');
  const checklist = await projectChecklistService.updateLocalItem(projectId, itemId, {
    ...parseUpdateBody(req.body),
    updatedByEmail: req.user?.email,
  });

  if (!checklist) {
    throw new AppError('Checklist item not found', 404, 'CHECKLIST_ITEM_NOT_FOUND');
  }

  res.json({ checklist });
}));

projectChecklistsRouter.post('/items', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const projectId = getParam(req.params.projectId, 'Project ID');
  const checklist = await projectChecklistService.createLocalItem(projectId, {
    ...parseCreateBody(req.body),
    createdByEmail: req.user?.email,
  });

  if (!checklist) {
    throw new AppError('Checklist section not found', 404, 'CHECKLIST_SECTION_NOT_FOUND');
  }

  res.status(201).json({ checklist });
}));

projectChecklistsRouter.delete('/items/:itemId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const projectId = getParam(req.params.projectId, 'Project ID');
  const itemId = getParam(req.params.itemId, 'Checklist item ID');
  const checklist = await projectChecklistService.deleteLocalItem(projectId, itemId, req.user?.email);

  if (!checklist) {
    throw new AppError('Checklist item not found', 404, 'CHECKLIST_ITEM_NOT_FOUND');
  }

  res.json({ checklist });
}));

projectChecklistsRouter.get('/export', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const projectId = getParam(req.params.projectId, 'Project ID');
  const file = await projectChecklistService.exportLocal(projectId);
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', makeContentDisposition(file.filename));
  res.send(file.buffer);
}));