import { auditService } from './audit.service.js';
import { teamEventsService } from './team-events.service.js';
import { AppError } from '../errors/app-error.js';
import { teamCalendarRepository } from '../repositories/team-calendar.repository.pg.js';

import type {
  CreateTeamPublicHolidayRequest,
  CreateTeamWfhChangeRequestRequest,
  DecideTeamWfhChangeRequestRequest,
  GenerateTeamWfhScheduleRequest,
  TeamCalendarEventsResponse,
  TeamPublicHoliday,
  TeamPublicHolidayListResponse,
  TeamRole,
  TeamWfhChangeRequest,
  TeamWfhChangeRequestListResponse,
  TeamWfhChangeRequestStatus,
  TeamWfhGroupCode,
  TeamWfhGroupMembersResponse,
  TeamWfhScheduleGenerationResponse,
  TeamWfhScheduleListResponse,
  TeamWfhScheduleStatus,
  UpdateTeamPublicHolidayRequest,
  UpdateTeamWfhGroupMembersRequest,
} from '@workspace/shared';

interface ActorContext {
  email: string;
  displayName?: string;
  teamRole?: TeamRole;
  ipAddress?: string;
  userAgent?: string;
}

interface ListHolidayParams {
  page: number;
  pageSize: number;
  search?: string;
  year?: number;
  month?: number;
  reducesAnnualLeave?: boolean;
}

interface ListScheduleParams {
  startDate?: string;
  endDate?: string;
  year?: number;
}

interface ListChangeRequestParams {
  page: number;
  pageSize: number;
  status?: TeamWfhChangeRequestStatus;
}

const groupCodes: TeamWfhGroupCode[] = ['A', 'B', 'C', 'D'];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const auditContext = (teamId: string, actor: ActorContext) => ({
  teamId,
  memberDisplayName: actor.displayName,
  ipAddress: actor.ipAddress,
  userAgent: actor.userAgent,
});

const asAuditValue = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;

const assertGroupCode = (value: unknown): TeamWfhGroupCode => {
  if (typeof value === 'string' && groupCodes.includes(value as TeamWfhGroupCode)) {
    return value as TeamWfhGroupCode;
  }
  throw new AppError('WFH group must be one of A, B, C, or D', 400, 'INVALID_WFH_GROUP');
};

const getGroupCodeByIndex = (index: number): TeamWfhGroupCode => {
  const normalizedIndex = ((index % groupCodes.length) + groupCodes.length) % groupCodes.length;
  switch (normalizedIndex) {
    case 0:
      return 'A';
    case 1:
      return 'B';
    case 2:
      return 'C';
    default:
      return 'D';
  }
};

const parseDateOnly = (value: string, field: string): Date => {
  if (!datePattern.test(value)) {
    throw new AppError(`${field} must use YYYY-MM-DD format`, 400, 'INVALID_DATE_FORMAT', [
      { field, message: 'Use YYYY-MM-DD format' },
    ]);
  }

  const [yearText, monthText, dayText] = value.split('-');
  const parsedYear = Number(yearText);
  const parsedMonth = Number(monthText);
  const parsedDay = Number(dayText);
  const parsedDate = new Date(Date.UTC(parsedYear, parsedMonth - 1, parsedDay));

  if (
    parsedDate.getUTCFullYear() !== parsedYear ||
    parsedDate.getUTCMonth() !== parsedMonth - 1 ||
    parsedDate.getUTCDate() !== parsedDay
  ) {
    throw new AppError(`${field} is not a valid calendar date`, 400, 'INVALID_DATE', [
      { field, message: 'Enter a valid calendar date' },
    ]);
  }

  return parsedDate;
};

const formatDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number): Date => {
  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
};

const isWorkday = (date: Date): boolean => {
  const dayOfWeek = date.getUTCDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5;
};

const assertWorkday = (dateText: string, field: string): void => {
  const parsedDate = parseDateOnly(dateText, field);
  if (!isWorkday(parsedDate)) {
    throw new AppError(`${field} must be a workday`, 400, 'DATE_NOT_WORKDAY', [
      { field, message: 'Choose a Monday-Friday date' },
    ]);
  }
};

const expandDateRange = (startDate: string, endDate: string): string[] => {
  const start = parseDateOnly(startDate, 'startDate');
  const end = parseDateOnly(endDate, 'endDate');

  if (start.getTime() > end.getTime()) {
    throw new AppError('End date must be on or after start date', 400, 'INVALID_DATE_RANGE');
  }

  const dates: string[] = [];
  let currentDate = start;
  while (currentDate.getTime() <= end.getTime()) {
    dates.push(formatDateOnly(currentDate));
    currentDate = addDays(currentDate, 1);
  }

  if (dates.length > 370) {
    throw new AppError('Date range is too large', 400, 'DATE_RANGE_TOO_LARGE');
  }

  return dates;
};

const parseOptionalNumber = (value: unknown, field: string): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue)) {
    throw new AppError(`${field} must be a number`, 400, 'INVALID_NUMBER');
  }
  return parsedValue;
};

const ensureCalendarRange = (startDate: string, endDate: string): string[] => {
  const dates = expandDateRange(startDate, endDate);
  if (dates.length > 370) {
    throw new AppError('Calendar range cannot exceed 370 days', 400, 'CALENDAR_RANGE_TOO_LARGE');
  }
  return dates;
};

const getYearBounds = (year: number): { startDate: string; endDate: string } => ({
  startDate: `${year}-01-01`,
  endDate: `${year}-12-31`,
});

const getNextAvailableWorkday = (date: Date, holidayDates: Set<string>): string => {
  let candidateDate = date;
  while (!isWorkday(candidateDate) || holidayDates.has(formatDateOnly(candidateDate))) {
    candidateDate = addDays(candidateDate, 1);
  }
  return formatDateOnly(candidateDate);
};

interface WfhScheduleSlot {
  id?: string;
  teamId: string;
  groupCode: TeamWfhGroupCode;
  originalDate: string;
  generationYear: number;
  generatedByEmail: string;
}

interface ResolvedWfhScheduleSlot extends WfhScheduleSlot {
  scheduleDate: string;
  status: TeamWfhScheduleStatus;
  conflictHolidayId?: string;
}

const applyHolidaySequence = (
  slots: WfhScheduleSlot[],
  holidays: TeamPublicHoliday[],
): { schedules: ResolvedWfhScheduleSlot[]; conflictCount: number } => {
  const holidayByDate = new Map(holidays.map((holiday) => [holiday.holidayDate, holiday]));
  const holidayDates = new Set(holidays.map((holiday) => holiday.holidayDate));
  const schedules: ResolvedWfhScheduleSlot[] = [];
  let nextAvailableFrom: string | undefined;
  let conflictCount = 0;

  for (const slot of [...slots].sort((left, right) =>
    left.originalDate.localeCompare(right.originalDate),
  )) {
    const earliestDate =
      nextAvailableFrom && nextAvailableFrom > slot.originalDate
        ? nextAvailableFrom
        : slot.originalDate;
    const scheduleDate = getNextAvailableWorkday(
      parseDateOnly(earliestDate, 'scheduleDate'),
      holidayDates,
    );
    const conflictHoliday = holidayByDate.get(slot.originalDate);
    const status: TeamWfhScheduleStatus =
      scheduleDate === slot.originalDate ? 'scheduled' : 'rescheduled';

    if (conflictHoliday) {
      conflictCount += 1;
    }

    schedules.push({
      ...slot,
      scheduleDate,
      status,
      conflictHolidayId: conflictHoliday?.id,
    });
    nextAvailableFrom = formatDateOnly(addDays(parseDateOnly(scheduleDate, 'scheduleDate'), 1));
  }

  return { schedules, conflictCount };
};

const buildGeneratedSchedules = (
  teamId: string,
  input: GenerateTeamWfhScheduleRequest,
  actor: ActorContext,
  holidays: TeamPublicHoliday[],
) => {
  const weekStart = parseDateOnly(input.weekStartDate, 'weekStartDate');
  if (weekStart.getUTCDay() !== 1) {
    throw new AppError('Week start date must be a Monday', 400, 'WEEK_START_NOT_MONDAY');
  }

  if (weekStart.getUTCFullYear() !== input.year) {
    throw new AppError(
      'Week start date must be in the generation year',
      400,
      'WEEK_START_YEAR_MISMATCH',
    );
  }

  const mondayGroupCode = assertGroupCode(input.mondayGroupCode);
  const mondayGroupIndex = groupCodes.indexOf(mondayGroupCode);
  const endDate = parseDateOnly(`${input.year}-12-31`, 'year');
  const slots: WfhScheduleSlot[] = [];
  let weekOffset = 0;
  let weekStartDate = weekStart;

  while (weekStartDate.getTime() <= endDate.getTime()) {
    const rotatingMondayIndex = (mondayGroupIndex + weekOffset) % groupCodes.length;
    const rotatingMondayGroup = getGroupCodeByIndex(rotatingMondayIndex);

    for (let dayOffset = 0; dayOffset < 5; dayOffset += 1) {
      const originalDateObject = addDays(weekStartDate, dayOffset);
      if (originalDateObject.getTime() > endDate.getTime()) {
        break;
      }

      const originalDate = formatDateOnly(originalDateObject);
      const groupCode =
        dayOffset === 4
          ? rotatingMondayGroup
          : getGroupCodeByIndex(rotatingMondayIndex + dayOffset);
      slots.push({
        teamId,
        groupCode,
        originalDate,
        generationYear: input.year,
        generatedByEmail: actor.email,
      });
    }

    weekOffset += 1;
    weekStartDate = addDays(weekStartDate, 7);
  }

  const generation = applyHolidaySequence(slots, holidays);

  return {
    schedules: generation.schedules,
    conflictCount: generation.conflictCount,
    rangeStartDate: input.weekStartDate,
    rangeEndDate: formatDateOnly(endDate),
  };
};

const isAdminRole = (role?: TeamRole): boolean => role === 'admin' || role === 'owner';

// After any holiday change, reapply holiday conflict logic to all existing schedules
// in the affected year so rescheduled days stay accurate without a full regeneration.
const reapplyHolidayAdjustments = async (teamId: string, year: number): Promise<number> => {
  const yearBounds = getYearBounds(year);
  const [holidays, rawSchedules] = await Promise.all([
    teamCalendarRepository.listHolidaysByDateRange(
      teamId,
      yearBounds.startDate,
      yearBounds.endDate,
    ),
    teamCalendarRepository.listRawSchedulesForYear(teamId, year),
  ]);

  if (rawSchedules.length === 0) {
    return 0;
  }

  const generation = applyHolidaySequence(
    rawSchedules.map((schedule) => ({
      id: schedule.id,
      teamId,
      groupCode: schedule.groupCode,
      originalDate: schedule.originalDate,
      generationYear: year,
      generatedByEmail: schedule.generatedByEmail,
    })),
    holidays,
  );

  const currentSchedulesById = new Map(rawSchedules.map((schedule) => [schedule.id, schedule]));
  const patches: Array<{
    id: string;
    scheduleDate: string;
    status: TeamWfhScheduleStatus;
    conflictHolidayId: string | null;
  }> = [];

  for (const schedule of generation.schedules) {
    const currentSchedule = schedule.id ? currentSchedulesById.get(schedule.id) : undefined;
    if (!schedule.id || !currentSchedule) {
      continue;
    }

    const expectedConflictId = schedule.conflictHolidayId ?? null;

    if (
      currentSchedule.scheduleDate !== schedule.scheduleDate ||
      currentSchedule.status !== schedule.status ||
      currentSchedule.conflictHolidayId !== expectedConflictId
    ) {
      patches.push({
        id: schedule.id,
        scheduleDate: schedule.scheduleDate,
        status: schedule.status,
        conflictHolidayId: expectedConflictId,
      });
    }
  }

  await teamCalendarRepository.patchScheduleHolidayAdjustments(teamId, patches);
  return patches.length;
};

export const teamCalendarService = {
  parseOptionalNumber,

  async reapplyWfhScheduleAdjustments(
    teamId: string,
    year: number,
    actor?: ActorContext,
  ): Promise<{ updatedCount: number }> {
    const updatedCount = await reapplyHolidayAdjustments(teamId, year);
    if (updatedCount > 0) {
      await teamEventsService.broadcast({
        teamId,
        resource: 'wfh',
        action: 'updated',
        resourceId: `${year}`,
        actorEmail: actor?.email ?? 'system',
      });
    }
    return { updatedCount };
  },

  async assertSchemaReady(): Promise<void> {
    const missingTables = await teamCalendarRepository.listMissingCalendarTables();
    if (missingTables.length > 0) {
      throw new AppError(
        'Team Calendar database schema is not installed. Run the latest shared schema SQL before using calendar settings.',
        503,
        'TEAM_CALENDAR_SCHEMA_REQUIRED',
        [
          {
            field: 'sharedDatabase',
            message: `Missing tables: ${missingTables.join(', ')}`,
          },
        ],
      );
    }
  },

  async listHolidays(
    teamId: string,
    params: ListHolidayParams,
  ): Promise<TeamPublicHolidayListResponse> {
    return teamCalendarRepository.listHolidays(teamId, params);
  },

  async createHolidays(
    teamId: string,
    input: CreateTeamPublicHolidayRequest,
    actor: ActorContext,
  ): Promise<{ holidays: TeamPublicHoliday[] }> {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name) {
      throw new AppError('Holiday name is required', 400, 'INVALID_HOLIDAY_NAME');
    }

    const endDate = input.isRange ? input.endDate : input.startDate;
    if (!endDate) {
      throw new AppError('End date is required for range holidays', 400, 'MISSING_END_DATE');
    }

    const holidayDates = expandDateRange(input.startDate, endDate);
    const sourceRangeId = holidayDates.length > 1 ? crypto.randomUUID() : undefined;
    const holidays = await teamCalendarRepository.createHolidays({
      teamId,
      name,
      description: input.description?.trim() || undefined,
      holidayDates,
      sourceRangeId,
      reducesAnnualLeave: input.reducesAnnualLeave ?? false,
      createdByEmail: actor.email,
    });

    await auditService.logCreate(
      actor.email,
      'team_public_holiday',
      sourceRangeId ?? holidays[0].id,
      asAuditValue({ holidays }),
      auditContext(teamId, actor),
    );
    await teamEventsService.broadcast({
      teamId,
      resource: 'calendar',
      action: 'created',
      resourceId: sourceRangeId ?? holidays[0].id,
      actorEmail: actor.email,
    });

    // Re-apply holiday adjustments for each affected year
    const affectedYears = [
      ...new Set(holidays.map((h) => new Date(h.holidayDate).getUTCFullYear())),
    ];
    await Promise.all(
      affectedYears.map(async (affectedYear) => {
        const updatedCount = await reapplyHolidayAdjustments(teamId, affectedYear);
        if (updatedCount > 0) {
          await teamEventsService.broadcast({
            teamId,
            resource: 'wfh',
            action: 'updated',
            resourceId: `${affectedYear}`,
            actorEmail: actor.email,
          });
        }
      }),
    );

    return { holidays };
  },

  async updateHoliday(
    teamId: string,
    holidayId: string,
    input: UpdateTeamPublicHolidayRequest,
    actor: ActorContext,
  ): Promise<{ holiday: TeamPublicHoliday }> {
    const existingHoliday = await teamCalendarRepository.getHoliday(teamId, holidayId);
    if (!existingHoliday) {
      throw new AppError('Public holiday not found', 404, 'PUBLIC_HOLIDAY_NOT_FOUND');
    }

    if (input.holidayDate) {
      parseDateOnly(input.holidayDate, 'holidayDate');
    }

    const holiday = await teamCalendarRepository.updateHoliday(teamId, holidayId, {
      name: input.name?.trim(),
      description: input.description,
      holidayDate: input.holidayDate,
      reducesAnnualLeave: input.reducesAnnualLeave,
      updatedByEmail: actor.email,
    });

    if (!holiday) {
      throw new AppError('Public holiday not found', 404, 'PUBLIC_HOLIDAY_NOT_FOUND');
    }

    await auditService.logUpdate(
      actor.email,
      'team_public_holiday',
      holiday.id,
      asAuditValue(existingHoliday),
      asAuditValue(holiday),
      auditContext(teamId, actor),
    );
    await teamEventsService.broadcast({
      teamId,
      resource: 'calendar',
      action: 'updated',
      resourceId: holiday.id,
      actorEmail: actor.email,
    });

    // Re-apply adjustments for old and new date's year
    const yearsToUpdate = [
      ...new Set([
        new Date(existingHoliday.holidayDate).getUTCFullYear(),
        new Date(holiday.holidayDate).getUTCFullYear(),
      ]),
    ];
    await Promise.all(
      yearsToUpdate.map(async (affectedYear) => {
        const updatedCount = await reapplyHolidayAdjustments(teamId, affectedYear);
        if (updatedCount > 0) {
          await teamEventsService.broadcast({
            teamId,
            resource: 'wfh',
            action: 'updated',
            resourceId: `${affectedYear}`,
            actorEmail: actor.email,
          });
        }
      }),
    );

    return { holiday };
  },

  async deleteHoliday(teamId: string, holidayId: string, actor: ActorContext): Promise<void> {
    const holiday = await teamCalendarRepository.deleteHoliday(teamId, holidayId);
    if (!holiday) {
      throw new AppError('Public holiday not found', 404, 'PUBLIC_HOLIDAY_NOT_FOUND');
    }

    await auditService.logDelete(
      actor.email,
      'team_public_holiday',
      holiday.id,
      asAuditValue(holiday),
      auditContext(teamId, actor),
    );
    await teamEventsService.broadcast({
      teamId,
      resource: 'calendar',
      action: 'deleted',
      resourceId: holiday.id,
      actorEmail: actor.email,
    });

    // Re-apply adjustments for the deleted holiday's year
    const deletedYear = new Date(holiday.holidayDate).getUTCFullYear();
    const updatedCount = await reapplyHolidayAdjustments(teamId, deletedYear);
    if (updatedCount > 0) {
      await teamEventsService.broadcast({
        teamId,
        resource: 'wfh',
        action: 'updated',
        resourceId: `${deletedYear}`,
        actorEmail: actor.email,
      });
    }
  },

  async listGroupMembers(teamId: string): Promise<TeamWfhGroupMembersResponse> {
    return { members: await teamCalendarRepository.listGroupMembers(teamId) };
  },

  async updateGroupMembers(
    teamId: string,
    input: UpdateTeamWfhGroupMembersRequest,
    actor: ActorContext,
  ): Promise<TeamWfhGroupMembersResponse> {
    if (!Array.isArray(input.assignments)) {
      throw new AppError('Assignments must be an array', 400, 'INVALID_ASSIGNMENTS');
    }

    const assignments = input.assignments.map((assignment) => ({
      email: assignment.email,
      groupCode: assertGroupCode(assignment.groupCode),
    }));

    const members = await teamCalendarRepository.upsertGroupAssignments(
      teamId,
      assignments,
      actor.email,
    );

    await auditService.logUpdate(
      actor.email,
      'team_wfh_group_members',
      teamId,
      asAuditValue({}),
      asAuditValue({ assignments }),
      auditContext(teamId, actor),
    );
    await teamEventsService.broadcast({
      teamId,
      resource: 'wfh',
      action: 'updated',
      resourceId: teamId,
      actorEmail: actor.email,
    });

    return { members };
  },

  async generateWfhSchedule(
    teamId: string,
    input: GenerateTeamWfhScheduleRequest,
    actor: ActorContext,
  ): Promise<TeamWfhScheduleGenerationResponse> {
    if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 3000) {
      throw new AppError('Year must be a valid four digit year', 400, 'INVALID_YEAR');
    }

    const existingCount = await teamCalendarRepository.countSchedulesForYear(teamId, input.year);
    if (existingCount > 0 && !input.regenerate) {
      throw new AppError(
        'WFH schedule already exists for this year',
        409,
        'WFH_SCHEDULE_ALREADY_EXISTS',
      );
    }

    const yearBounds = getYearBounds(input.year);
    const holidays = await teamCalendarRepository.listHolidaysByDateRange(
      teamId,
      yearBounds.startDate,
      yearBounds.endDate,
    );
    const generation = buildGeneratedSchedules(teamId, input, actor, holidays);
    const result = await teamCalendarRepository.replaceGeneratedSchedules(
      teamId,
      input.year,
      generation.schedules,
    );

    await auditService.logCreate(
      actor.email,
      'team_wfh_schedule_generation',
      `${teamId}:${input.year}`,
      asAuditValue({
        year: input.year,
        createdCount: result.schedules.length,
        deletedCount: result.deletedCount,
        conflictCount: generation.conflictCount,
      }),
      auditContext(teamId, actor),
    );
    await teamEventsService.broadcast({
      teamId,
      resource: 'wfh',
      action: 'created',
      resourceId: `${input.year}`,
      actorEmail: actor.email,
    });

    return {
      result: {
        year: input.year,
        createdCount: result.schedules.length,
        deletedCount: result.deletedCount,
        conflictCount: generation.conflictCount,
        rangeStartDate: generation.rangeStartDate,
        rangeEndDate: generation.rangeEndDate,
      },
    };
  },

  async listSchedules(
    teamId: string,
    params: ListScheduleParams,
  ): Promise<TeamWfhScheduleListResponse> {
    if (params.startDate) {
      parseDateOnly(params.startDate, 'startDate');
    }
    if (params.endDate) {
      parseDateOnly(params.endDate, 'endDate');
    }
    return { items: await teamCalendarRepository.listSchedules(teamId, params) };
  },

  async listChangeRequests(
    teamId: string,
    params: ListChangeRequestParams,
    actor: ActorContext,
  ): Promise<TeamWfhChangeRequestListResponse> {
    const requesterEmail = isAdminRole(actor.teamRole) ? undefined : actor.email;
    return teamCalendarRepository.listChangeRequests(teamId, { ...params, requesterEmail });
  },

  async createChangeRequest(
    teamId: string,
    input: CreateTeamWfhChangeRequestRequest,
    actor: ActorContext,
  ): Promise<{ request: TeamWfhChangeRequest }> {
    const schedule = await teamCalendarRepository.getSchedule(teamId, input.scheduleId);
    if (!schedule) {
      throw new AppError('WFH schedule not found', 404, 'WFH_SCHEDULE_NOT_FOUND');
    }

    assertWorkday(input.requestedDate, 'requestedDate');
    const requestedDateHoliday = await teamCalendarRepository.listHolidaysByDateRange(
      teamId,
      input.requestedDate,
      input.requestedDate,
    );
    if (requestedDateHoliday.length > 0) {
      throw new AppError(
        'Requested WFH date cannot be a public holiday',
        409,
        'REQUEST_DATE_IS_HOLIDAY',
      );
    }

    const isScheduleMember = schedule.members.some((member) => member.email === actor.email);
    if (!isScheduleMember) {
      throw new AppError(
        'Only members assigned to this WFH group can request a change',
        403,
        'NOT_ASSIGNED_TO_WFH_GROUP',
      );
    }

    const pendingRequest = await teamCalendarRepository.findPendingChangeRequest(
      teamId,
      schedule.id,
      actor.email,
    );
    if (pendingRequest) {
      throw new AppError(
        'A pending change request already exists for this schedule',
        409,
        'PENDING_WFH_REQUEST_EXISTS',
      );
    }

    const request = await teamCalendarRepository.createChangeRequest({
      teamId,
      scheduleId: schedule.id,
      requesterEmail: actor.email,
      groupCode: schedule.groupCode,
      originalDate: schedule.scheduleDate,
      requestedDate: input.requestedDate,
      reason: input.reason?.trim() || undefined,
    });

    await auditService.logCreate(
      actor.email,
      'team_wfh_change_request',
      request.id,
      asAuditValue(request),
      auditContext(teamId, actor),
    );
    await teamEventsService.broadcast({
      teamId,
      resource: 'wfh',
      action: 'created',
      resourceId: request.id,
      actorEmail: actor.email,
    });

    return { request };
  },

  async approveChangeRequest(
    teamId: string,
    requestId: string,
    input: DecideTeamWfhChangeRequestRequest,
    actor: ActorContext,
  ): Promise<{ request: TeamWfhChangeRequest }> {
    return this.decideChangeRequest(teamId, requestId, 'approved', input, actor);
  },

  async rejectChangeRequest(
    teamId: string,
    requestId: string,
    input: DecideTeamWfhChangeRequestRequest,
    actor: ActorContext,
  ): Promise<{ request: TeamWfhChangeRequest }> {
    return this.decideChangeRequest(teamId, requestId, 'rejected', input, actor);
  },

  async decideChangeRequest(
    teamId: string,
    requestId: string,
    status: 'approved' | 'rejected',
    input: DecideTeamWfhChangeRequestRequest,
    actor: ActorContext,
  ): Promise<{ request: TeamWfhChangeRequest }> {
    const existingRequest = await teamCalendarRepository.getChangeRequest(teamId, requestId);
    if (!existingRequest) {
      throw new AppError('WFH change request not found', 404, 'WFH_CHANGE_REQUEST_NOT_FOUND');
    }
    if (existingRequest.status !== 'pending') {
      throw new AppError(
        'Only pending WFH change requests can be decided',
        409,
        'WFH_CHANGE_REQUEST_NOT_PENDING',
      );
    }

    if (status === 'approved') {
      const requestedDateHoliday = await teamCalendarRepository.listHolidaysByDateRange(
        teamId,
        existingRequest.requestedDate,
        existingRequest.requestedDate,
      );
      if (requestedDateHoliday.length > 0) {
        throw new AppError(
          'Requested WFH date cannot be a public holiday',
          409,
          'REQUEST_DATE_IS_HOLIDAY',
        );
      }
    }

    const request = await teamCalendarRepository.updateChangeRequestStatus({
      teamId,
      requestId,
      status,
      approverEmail: actor.email,
      decisionNote: input.decisionNote?.trim() || undefined,
    });
    if (!request) {
      throw new AppError('WFH change request not found', 404, 'WFH_CHANGE_REQUEST_NOT_FOUND');
    }

    await auditService.logUpdate(
      actor.email,
      'team_wfh_change_request',
      request.id,
      asAuditValue(existingRequest),
      asAuditValue(request),
      auditContext(teamId, actor),
    );
    await teamEventsService.broadcast({
      teamId,
      resource: 'wfh',
      action: 'updated',
      resourceId: request.id,
      actorEmail: actor.email,
    });

    return { request };
  },

  async getCalendarEvents(
    teamId: string,
    startDate: string,
    endDate: string,
  ): Promise<TeamCalendarEventsResponse> {
    const dates = ensureCalendarRange(startDate, endDate);
    const holidays = await teamCalendarRepository.listHolidaysByDateRange(
      teamId,
      startDate,
      endDate,
    );
    const schedules = await teamCalendarRepository.listSchedules(teamId, { startDate, endDate });
    const approvedRequests = await teamCalendarRepository.listApprovedRequestsByDateRange(
      teamId,
      startDate,
      endDate,
    );
    const approvedRequestersBySchedule = new Map<string, Set<string>>();

    for (const request of approvedRequests) {
      if (!request.scheduleId) {
        continue;
      }
      const requesters = approvedRequestersBySchedule.get(request.scheduleId) ?? new Set<string>();
      requesters.add(request.requesterEmail);
      approvedRequestersBySchedule.set(request.scheduleId, requesters);
    }

    const daysByDate = new Map(
      dates.map((date) => [
        date,
        {
          date,
          holidays: [] as TeamPublicHoliday[],
          wfhSchedules: [] as Awaited<ReturnType<typeof teamCalendarRepository.listSchedules>>,
          approvedRequests: [] as TeamWfhChangeRequest[],
        },
      ]),
    );

    for (const holiday of holidays) {
      daysByDate.get(holiday.holidayDate)?.holidays.push(holiday);
    }

    for (const schedule of schedules) {
      const excludedRequesters = approvedRequestersBySchedule.get(schedule.id);
      const adjustedSchedule = excludedRequesters
        ? {
            ...schedule,
            members: schedule.members.filter((member) => !excludedRequesters.has(member.email)),
          }
        : schedule;
      daysByDate.get(schedule.scheduleDate)?.wfhSchedules.push(adjustedSchedule);
    }

    for (const request of approvedRequests) {
      daysByDate.get(request.requestedDate)?.approvedRequests.push(request);
    }

    return { days: Array.from(daysByDate.values()) };
  },
};
