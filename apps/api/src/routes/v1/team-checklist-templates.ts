import multer from 'multer';
import { Router } from 'express';

import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireTeamRole } from '../../middleware/team-rbac.middleware.js';
import { auditService } from '../../services/audit.service.js';
import { checklistTemplateService } from '../../services/checklist-template.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

import type { TeamAuthenticatedRequest } from '../../middleware/team-rbac.middleware.js';
import type { RequestHandler, Response } from 'express';

export const teamChecklistTemplatesRouter = Router({ mergeParams: true });

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

const auditContext = (req: TeamAuthenticatedRequest) => ({
  teamId: req.teamId,
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
});

teamChecklistTemplatesRouter.use(requireAuth as RequestHandler);

teamChecklistTemplatesRouter.get('/', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const teamId = getParam(req.params.teamId, 'Team ID');
  const items = await checklistTemplateService.listTeam(teamId);
  res.json({ items });
}));

teamChecklistTemplatesRouter.get('/:templateId', requireTeamRole('member'), asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
  const teamId = getParam(req.params.teamId, 'Team ID');
  const templateId = getParam(req.params.templateId, 'Template ID');
  const template = await checklistTemplateService.getTeam(teamId, templateId);
  if (!template) {
    throw new AppError('Checklist template not found', 404, 'CHECKLIST_TEMPLATE_NOT_FOUND');
  }
  res.json({ template });
}));

teamChecklistTemplatesRouter.post(
  '/',
  requireTeamRole('admin'),
  templateUpload.single('template'),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    if (!req.file) {
      throw new AppError('No checklist template file provided. Use form field "template".', 400, 'VALIDATION_ERROR');
    }

    const teamId = getParam(req.params.teamId, 'Team ID');

    const template = await checklistTemplateService.registerTeam({
      teamId,
      templateId: typeof req.body.templateId === 'string' ? req.body.templateId : undefined,
      name: req.body.name,
      description: req.body.description,
      versionLabel: req.body.versionLabel,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      buffer: req.file.buffer,
      uploadedByEmail: req.memberEmail ?? req.user?.email,
      activate: parseActivateFlag(req.body.activate),
    });

    await auditService.logCreate(
      req.memberEmail,
      'checklist_template',
      template.id,
      {
        templateId: template.id,
        activeVersionId: template.activeVersion?.id,
        checksumSha256: template.activeVersion?.checksumSha256,
      },
      auditContext(req),
    );

    res.status(201).json({ template });
  }),
);

teamChecklistTemplatesRouter.patch(
  '/:templateId/versions/:versionId/activate',
  requireTeamRole('admin'),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    const teamId = getParam(req.params.teamId, 'Team ID');
    const templateId = getParam(req.params.templateId, 'Template ID');
    const versionId = getParam(req.params.versionId, 'Template version ID');
    const template = await checklistTemplateService.activateTeam(
      teamId,
      templateId,
      versionId,
      req.memberEmail ?? req.user?.email,
    );
    if (!template) {
      throw new AppError('Checklist template version not found', 404, 'CHECKLIST_TEMPLATE_VERSION_NOT_FOUND');
    }

    await auditService.logUpdate(
      req.memberEmail,
      'checklist_template',
      template.id,
      { activeVersionChanged: true },
      { activeVersionId: template.activeVersion?.id },
      auditContext(req),
    );

    res.json({ template });
  }),
);

teamChecklistTemplatesRouter.get(
  '/:templateId/versions/:versionId/file',
  requireTeamRole('member'),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    const teamId = getParam(req.params.teamId, 'Team ID');
    const templateId = getParam(req.params.templateId, 'Template ID');
    const versionId = getParam(req.params.versionId, 'Template version ID');
    const file = await checklistTemplateService.getTeamFile(teamId, templateId, versionId);
    if (!file) {
      throw new AppError('Checklist template version not found', 404, 'CHECKLIST_TEMPLATE_VERSION_NOT_FOUND');
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', makeContentDisposition(file.originalFilename));
    res.send(file.xlsxBuffer);
  }),
);