import multer from 'multer';
import { Router } from 'express';

import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { checklistTemplateService } from '../../services/checklist-template.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

import type { AuthenticatedRequest } from '../../middleware/auth.middleware.js';
import type { RequestHandler, Response } from 'express';

export const checklistTemplatesRouter = Router();

const templateUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const makeContentDisposition = (filename: string): string => {
  const safeFilename = filename.replace(/["\\\r\n]/g, '_');
  return `attachment; filename="${safeFilename}"`;
};

const parseActivateFlag = (value: unknown): boolean => {
  if (typeof value !== 'string') return true;
  return value.toLowerCase() !== 'false';
};

const getParam = (value: string | string[] | undefined, name: string): string => {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  throw new AppError(`${name} is required`, 400, 'VALIDATION_ERROR');
};

checklistTemplatesRouter.use(requireAuth as RequestHandler);

checklistTemplatesRouter.get('/', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const items = await checklistTemplateService.listLocal();
  res.json({ items });
}));

checklistTemplatesRouter.get('/:templateId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const templateId = getParam(req.params.templateId, 'Template ID');
  const template = await checklistTemplateService.getLocal(templateId);
  if (!template) {
    throw new AppError('Checklist template not found', 404, 'CHECKLIST_TEMPLATE_NOT_FOUND');
  }
  res.json({ template });
}));

checklistTemplatesRouter.post(
  '/',
  templateUpload.single('template'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      throw new AppError('No checklist template file provided. Use form field "template".', 400, 'VALIDATION_ERROR');
    }

    const template = await checklistTemplateService.registerLocal({
      templateId: typeof req.body.templateId === 'string' ? req.body.templateId : undefined,
      name: req.body.name,
      description: req.body.description,
      versionLabel: req.body.versionLabel,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      buffer: req.file.buffer,
      uploadedByEmail: req.user?.email,
      activate: parseActivateFlag(req.body.activate),
    });

    res.status(201).json({ template });
  }),
);

checklistTemplatesRouter.patch('/:templateId/versions/:versionId/activate', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const templateId = getParam(req.params.templateId, 'Template ID');
  const versionId = getParam(req.params.versionId, 'Template version ID');
  const template = await checklistTemplateService.activateLocal(templateId, versionId, req.user?.email);
  if (!template) {
    throw new AppError('Checklist template version not found', 404, 'CHECKLIST_TEMPLATE_VERSION_NOT_FOUND');
  }
  res.json({ template });
}));

checklistTemplatesRouter.get('/:templateId/versions/:versionId/file', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const templateId = getParam(req.params.templateId, 'Template ID');
  const versionId = getParam(req.params.versionId, 'Template version ID');
  const file = await checklistTemplateService.getLocalFile(templateId, versionId);
  if (!file) {
    throw new AppError('Checklist template version not found', 404, 'CHECKLIST_TEMPLATE_VERSION_NOT_FOUND');
  }

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', makeContentDisposition(file.originalFilename));
  res.send(file.xlsxBuffer);
}));