import { Router } from 'express';

import { AppError } from '../../errors/app-error.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireTeamRole } from '../../middleware/team-rbac.middleware.js';
import { parsePaginationQuery } from '../../schemas/pagination.js';
import { teamCalendarService } from '../../services/team-calendar.service.js';
import { asyncHandler } from '../../utils/async-handler.js';

import type { TeamAuthenticatedRequest } from '../../middleware/team-rbac.middleware.js';
import type { TeamWfhChangeRequestStatus } from '@workspace/shared';
import type { RequestHandler, Response } from 'express';

export const teamCalendarRouter = Router({ mergeParams: true });

teamCalendarRouter.use(requireAuth as RequestHandler);
teamCalendarRouter.use(
  asyncHandler(async (_req, _res, next) => {
    await teamCalendarService.assertSchemaReady();
    next();
  }),
);

const getRequiredParam = (
  req: TeamAuthenticatedRequest,
  paramName: string,
  errorCode: string,
): string => {
  const value = req.params[paramName];
  if (typeof value !== 'string' || !value) {
    throw new AppError(`${paramName} is required`, 400, errorCode);
  }
  return value;
};

const getRequiredTeamId = (req: TeamAuthenticatedRequest): string =>
  getRequiredParam(req, 'teamId', 'MISSING_TEAM_ID');

const getActor = (req: TeamAuthenticatedRequest) => {
  const email = req.memberEmail ?? req.user?.email;
  if (!email) {
    throw new AppError('User email not found', 401, 'UNAUTHORIZED');
  }

  return {
    email,
    displayName: req.user?.displayName,
    teamRole: req.teamRole,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
};

const parseBooleanQuery = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === 'true' || value === true) {
    return true;
  }
  if (value === 'false' || value === false) {
    return false;
  }
  throw new AppError('Boolean query value must be true or false', 400, 'INVALID_BOOLEAN_QUERY');
};

const parseRequestStatus = (value: unknown): TeamWfhChangeRequestStatus | undefined => {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }
  if (['pending', 'approved', 'rejected', 'cancelled'].includes(value)) {
    return value as TeamWfhChangeRequestStatus;
  }
  throw new AppError('Invalid WFH change request status', 400, 'INVALID_WFH_REQUEST_STATUS');
};

teamCalendarRouter.get(
  '/holidays',
  requireTeamRole('member'),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    const pagination = parsePaginationQuery(req.query);
    const response = await teamCalendarService.listHolidays(getRequiredTeamId(req), {
      ...pagination,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      year: teamCalendarService.parseOptionalNumber(req.query.year, 'year'),
      month: teamCalendarService.parseOptionalNumber(req.query.month, 'month'),
      reducesAnnualLeave: parseBooleanQuery(req.query.reducesAnnualLeave),
    });

    res.json(response);
  }),
);

teamCalendarRouter.post(
  '/holidays',
  requireTeamRole('admin'),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    const response = await teamCalendarService.createHolidays(
      getRequiredTeamId(req),
      req.body,
      getActor(req),
    );
    res.status(201).json(response);
  }),
);

teamCalendarRouter.put(
  '/holidays/:holidayId',
  requireTeamRole('admin'),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    const response = await teamCalendarService.updateHoliday(
      getRequiredTeamId(req),
      getRequiredParam(req, 'holidayId', 'MISSING_HOLIDAY_ID'),
      req.body,
      getActor(req),
    );
    res.json(response);
  }),
);

teamCalendarRouter.delete(
  '/holidays/:holidayId',
  requireTeamRole('admin'),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    await teamCalendarService.deleteHoliday(
      getRequiredTeamId(req),
      getRequiredParam(req, 'holidayId', 'MISSING_HOLIDAY_ID'),
      getActor(req),
    );
    res.status(204).send();
  }),
);

teamCalendarRouter.get(
  '/wfh/groups',
  requireTeamRole('member'),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    const response = await teamCalendarService.listGroupMembers(getRequiredTeamId(req));
    res.json(response);
  }),
);

teamCalendarRouter.put(
  '/wfh/groups/members',
  requireTeamRole('admin'),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    const response = await teamCalendarService.updateGroupMembers(
      getRequiredTeamId(req),
      req.body,
      getActor(req),
    );
    res.json(response);
  }),
);

teamCalendarRouter.post(
  '/wfh/generate',
  requireTeamRole('admin'),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    const response = await teamCalendarService.generateWfhSchedule(
      getRequiredTeamId(req),
      req.body,
      getActor(req),
    );
    res.status(201).json(response);
  }),
);

teamCalendarRouter.get(
  '/wfh/schedules',
  requireTeamRole('member'),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    const response = await teamCalendarService.listSchedules(getRequiredTeamId(req), {
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
      year: teamCalendarService.parseOptionalNumber(req.query.year, 'year'),
    });
    res.json(response);
  }),
);

teamCalendarRouter.get(
  '/wfh/change-requests',
  requireTeamRole('member'),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    const pagination = parsePaginationQuery(req.query);
    const response = await teamCalendarService.listChangeRequests(
      getRequiredTeamId(req),
      {
        ...pagination,
        status: parseRequestStatus(req.query.status),
      },
      getActor(req),
    );
    res.json(response);
  }),
);

teamCalendarRouter.post(
  '/wfh/change-requests',
  requireTeamRole('member'),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    const response = await teamCalendarService.createChangeRequest(
      getRequiredTeamId(req),
      req.body,
      getActor(req),
    );
    res.status(201).json(response);
  }),
);

teamCalendarRouter.post(
  '/wfh/change-requests/:requestId/approve',
  requireTeamRole('admin'),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    const response = await teamCalendarService.approveChangeRequest(
      getRequiredTeamId(req),
      getRequiredParam(req, 'requestId', 'MISSING_REQUEST_ID'),
      req.body,
      getActor(req),
    );
    res.json(response);
  }),
);

teamCalendarRouter.post(
  '/wfh/change-requests/:requestId/reject',
  requireTeamRole('admin'),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    const response = await teamCalendarService.rejectChangeRequest(
      getRequiredTeamId(req),
      getRequiredParam(req, 'requestId', 'MISSING_REQUEST_ID'),
      req.body,
      getActor(req),
    );
    res.json(response);
  }),
);

teamCalendarRouter.get(
  '/events',
  requireTeamRole('member'),
  asyncHandler(async (req: TeamAuthenticatedRequest, res: Response) => {
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
    if (!startDate || !endDate) {
      throw new AppError('startDate and endDate are required', 400, 'MISSING_DATE_RANGE');
    }

    const response = await teamCalendarService.getCalendarEvents(
      getRequiredTeamId(req),
      startDate,
      endDate,
    );
    res.json(response);
  }),
);
