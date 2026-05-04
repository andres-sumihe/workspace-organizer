import { SHARED_SCHEMA, getSharedClient, query, queryOne } from '../db/shared-client.js';

import type {
  TeamPublicHoliday,
  TeamRole,
  TeamWfhChangeRequest,
  TeamWfhChangeRequestStatus,
  TeamWfhGroupCode,
  TeamWfhGroupMember,
  TeamWfhSchedule,
  TeamWfhScheduleMember,
  TeamWfhScheduleStatus,
} from '@workspace/shared';

interface HolidayRow {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  holiday_date: string | Date;
  source_range_id: string | null;
  reduces_annual_leave: boolean;
  created_by_email: string;
  updated_by_email: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface GroupMemberRow {
  team_id: string;
  email: string;
  display_name: string | null;
  role: TeamRole;
  group_code: TeamWfhGroupCode | null;
  updated_by_email: string | null;
  updated_at: string | Date | null;
}

interface ScheduleRow {
  id: string;
  team_id: string;
  group_code: TeamWfhGroupCode;
  original_date: string | Date;
  schedule_date: string | Date;
  status: TeamWfhScheduleStatus;
  conflict_holiday_id: string | null;
  generation_year: number;
  generated_by_email: string;
  created_at: string | Date;
  updated_at: string | Date;
}

interface ChangeRequestRow {
  id: string;
  team_id: string;
  schedule_id: string | null;
  requester_email: string;
  requester_display_name: string | null;
  group_code: TeamWfhGroupCode;
  original_date: string | Date;
  requested_date: string | Date;
  reason: string | null;
  status: TeamWfhChangeRequestStatus;
  approver_email: string | null;
  decision_note: string | null;
  decided_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface PaginatedRepositoryResult<TItem> {
  items: TItem[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ListHolidayFilters {
  page: number;
  pageSize: number;
  search?: string;
  year?: number;
  month?: number;
  reducesAnnualLeave?: boolean;
}

export interface CreateHolidayRowsInput {
  teamId: string;
  name: string;
  description?: string;
  holidayDates: string[];
  sourceRangeId?: string;
  reducesAnnualLeave: boolean;
  createdByEmail: string;
}

export interface UpdateHolidayInput {
  name?: string;
  description?: string;
  holidayDate?: string;
  reducesAnnualLeave?: boolean;
  updatedByEmail: string;
}

export interface GeneratedScheduleInput {
  teamId: string;
  groupCode: TeamWfhGroupCode;
  originalDate: string;
  scheduleDate: string;
  status: TeamWfhScheduleStatus;
  conflictHolidayId?: string;
  generationYear: number;
  generatedByEmail: string;
}

export interface ReplaceGeneratedSchedulesResult {
  deletedCount: number;
  schedules: TeamWfhSchedule[];
}

export interface ListScheduleFilters {
  startDate?: string;
  endDate?: string;
  year?: number;
}

export interface RawScheduleForReapply {
  id: string;
  groupCode: TeamWfhGroupCode;
  originalDate: string;
  scheduleDate: string;
  status: TeamWfhScheduleStatus;
  conflictHolidayId: string | null;
  generatedByEmail: string;
}

export interface ScheduleHolidayPatch {
  id: string;
  scheduleDate: string;
  status: TeamWfhScheduleStatus;
  conflictHolidayId: string | null;
}

export interface ListChangeRequestFilters {
  page: number;
  pageSize: number;
  status?: TeamWfhChangeRequestStatus;
  requesterEmail?: string;
}

const requiredCalendarTables = [
  'team_public_holidays',
  'team_wfh_group_members',
  'team_wfh_schedules',
  'team_wfh_change_requests',
] as const;

const padDatePart = (value: number): string => String(value).padStart(2, '0');

const toDateOnly = (value: string | Date): string => {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${padDatePart(value.getMonth() + 1)}-${padDatePart(value.getDate())}`;
  }
  return String(value).slice(0, 10);
};

const toIsoString = (value: string | Date): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
};

const mapHoliday = (row: HolidayRow): TeamPublicHoliday => ({
  id: row.id,
  teamId: row.team_id,
  name: row.name,
  description: row.description ?? undefined,
  holidayDate: toDateOnly(row.holiday_date),
  sourceRangeId: row.source_range_id ?? undefined,
  reducesAnnualLeave: row.reduces_annual_leave,
  createdByEmail: row.created_by_email,
  updatedByEmail: row.updated_by_email ?? undefined,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const mapGroupMember = (row: GroupMemberRow): TeamWfhGroupMember => ({
  teamId: row.team_id,
  email: row.email,
  displayName: row.display_name ?? undefined,
  role: row.role,
  groupCode: row.group_code ?? undefined,
  updatedByEmail: row.updated_by_email ?? undefined,
  updatedAt: row.updated_at ? toIsoString(row.updated_at) : undefined,
});

const mapSchedule = (row: ScheduleRow, members: TeamWfhScheduleMember[] = []): TeamWfhSchedule => ({
  id: row.id,
  teamId: row.team_id,
  groupCode: row.group_code,
  originalDate: toDateOnly(row.original_date),
  scheduleDate: toDateOnly(row.schedule_date),
  status: row.status,
  conflictHolidayId: row.conflict_holiday_id ?? undefined,
  generationYear: row.generation_year,
  generatedByEmail: row.generated_by_email,
  members,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const mapChangeRequest = (row: ChangeRequestRow): TeamWfhChangeRequest => ({
  id: row.id,
  teamId: row.team_id,
  scheduleId: row.schedule_id ?? undefined,
  requesterEmail: row.requester_email,
  requesterDisplayName: row.requester_display_name ?? undefined,
  groupCode: row.group_code,
  originalDate: toDateOnly(row.original_date),
  requestedDate: toDateOnly(row.requested_date),
  reason: row.reason ?? undefined,
  status: row.status,
  approverEmail: row.approver_email ?? undefined,
  decisionNote: row.decision_note ?? undefined,
  decidedAt: row.decided_at ? toIsoString(row.decided_at) : undefined,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
});

const buildPaginationMeta = (total: number, page: number, pageSize: number) => ({
  total,
  page,
  pageSize,
  hasNextPage: page * pageSize < total,
  hasPreviousPage: page > 1,
});

const getMembersByGroup = async (
  teamId: string,
): Promise<Record<TeamWfhGroupCode, TeamWfhScheduleMember[]>> => {
  const rows = await query<GroupMemberRow>(
    `SELECT tm.team_id, tm.email, tm.display_name, tm.role, gm.group_code, gm.updated_by_email, gm.updated_at
     FROM team_members tm
     JOIN team_wfh_group_members gm ON gm.team_id = tm.team_id AND gm.member_email = tm.email
     WHERE tm.team_id = $1
     ORDER BY tm.display_name NULLS LAST, tm.email`,
    [teamId],
  );

  const membersByGroup: Record<TeamWfhGroupCode, TeamWfhScheduleMember[]> = {
    A: [],
    B: [],
    C: [],
    D: [],
  };

  for (const row of rows) {
    if (!row.group_code) {
      continue;
    }
    membersByGroup[row.group_code].push({
      email: row.email,
      displayName: row.display_name ?? undefined,
    });
  }

  return membersByGroup;
};

const mapSchedulesWithMembers = async (
  teamId: string,
  rows: ScheduleRow[],
): Promise<TeamWfhSchedule[]> => {
  const membersByGroup = await getMembersByGroup(teamId);
  return rows.map((row) => mapSchedule(row, membersByGroup[row.group_code] ?? []));
};

export const teamCalendarRepository = {
  async listMissingCalendarTables(): Promise<string[]> {
    const rows = await query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = ANY($2::text[])`,
      [SHARED_SCHEMA, [...requiredCalendarTables]],
    );
    const existingTables = new Set(rows.map((row) => row.table_name));
    return requiredCalendarTables.filter((tableName) => !existingTables.has(tableName));
  },

  async listHolidays(
    teamId: string,
    filters: ListHolidayFilters,
  ): Promise<PaginatedRepositoryResult<TeamPublicHoliday>> {
    const conditions = ['team_id = $1'];
    const values: unknown[] = [teamId];
    let parameterIndex = 2;

    if (filters.search?.trim()) {
      conditions.push(`(name ILIKE $${parameterIndex} OR description ILIKE $${parameterIndex})`);
      values.push(`%${filters.search.trim()}%`);
      parameterIndex += 1;
    }

    if (filters.year) {
      conditions.push(`EXTRACT(YEAR FROM holiday_date) = $${parameterIndex}`);
      values.push(filters.year);
      parameterIndex += 1;
    }

    if (filters.month) {
      conditions.push(`EXTRACT(MONTH FROM holiday_date) = $${parameterIndex}`);
      values.push(filters.month);
      parameterIndex += 1;
    }

    if (filters.reducesAnnualLeave !== undefined) {
      conditions.push(`reduces_annual_leave = $${parameterIndex}`);
      values.push(filters.reducesAnnualLeave);
      parameterIndex += 1;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(1) as count FROM team_public_holidays ${whereClause}`,
      values,
    );
    const total = countRow ? parseInt(countRow.count, 10) : 0;
    const limit = filters.pageSize;
    const offset = (filters.page - 1) * filters.pageSize;

    const rows = await query<HolidayRow>(
      `SELECT * FROM team_public_holidays ${whereClause}
       ORDER BY holiday_date ASC, name ASC
       LIMIT $${parameterIndex} OFFSET $${parameterIndex + 1}`,
      [...values, limit, offset],
    );

    return {
      items: rows.map(mapHoliday),
      meta: buildPaginationMeta(total, filters.page, filters.pageSize),
    };
  },

  async listHolidaysByDateRange(
    teamId: string,
    startDate: string,
    endDate: string,
  ): Promise<TeamPublicHoliday[]> {
    const rows = await query<HolidayRow>(
      `SELECT * FROM team_public_holidays
       WHERE team_id = $1 AND holiday_date BETWEEN $2 AND $3
       ORDER BY holiday_date ASC, name ASC`,
      [teamId, startDate, endDate],
    );
    return rows.map(mapHoliday);
  },

  async getHoliday(teamId: string, holidayId: string): Promise<TeamPublicHoliday | null> {
    const row = await queryOne<HolidayRow>(
      'SELECT * FROM team_public_holidays WHERE team_id = $1 AND id = $2',
      [teamId, holidayId],
    );
    return row ? mapHoliday(row) : null;
  },

  async createHolidays(input: CreateHolidayRowsInput): Promise<TeamPublicHoliday[]> {
    const client = await getSharedClient();
    try {
      await client.query('BEGIN');
      const rows: HolidayRow[] = [];

      for (const holidayDate of input.holidayDates) {
        const result = await client.query<HolidayRow>(
          `INSERT INTO team_public_holidays
             (team_id, name, description, holiday_date, source_range_id, reduces_annual_leave, created_by_email)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT ON CONSTRAINT team_public_holidays_unique_name_date
           DO UPDATE SET
             description = EXCLUDED.description,
             source_range_id = EXCLUDED.source_range_id,
             reduces_annual_leave = EXCLUDED.reduces_annual_leave,
             updated_by_email = EXCLUDED.created_by_email
           RETURNING *`,
          [
            input.teamId,
            input.name,
            input.description ?? null,
            holidayDate,
            input.sourceRangeId ?? null,
            input.reducesAnnualLeave,
            input.createdByEmail,
          ],
        );
        rows.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return rows.map(mapHoliday);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async updateHoliday(
    teamId: string,
    holidayId: string,
    input: UpdateHolidayInput,
  ): Promise<TeamPublicHoliday | null> {
    const row = await queryOne<HolidayRow>(
      `UPDATE team_public_holidays
       SET
         name = COALESCE($3, name),
         description = CASE WHEN $4::boolean THEN $5 ELSE description END,
         holiday_date = COALESCE($6, holiday_date),
         reduces_annual_leave = COALESCE($7, reduces_annual_leave),
         updated_by_email = $8
       WHERE team_id = $1 AND id = $2
       RETURNING *`,
      [
        teamId,
        holidayId,
        input.name ?? null,
        input.description !== undefined,
        input.description ?? null,
        input.holidayDate ?? null,
        input.reducesAnnualLeave ?? null,
        input.updatedByEmail,
      ],
    );
    return row ? mapHoliday(row) : null;
  },

  async deleteHoliday(teamId: string, holidayId: string): Promise<TeamPublicHoliday | null> {
    const row = await queryOne<HolidayRow>(
      'DELETE FROM team_public_holidays WHERE team_id = $1 AND id = $2 RETURNING *',
      [teamId, holidayId],
    );
    return row ? mapHoliday(row) : null;
  },

  async listGroupMembers(teamId: string): Promise<TeamWfhGroupMember[]> {
    const rows = await query<GroupMemberRow>(
      `SELECT tm.team_id, tm.email, tm.display_name, tm.role, gm.group_code, gm.updated_by_email, gm.updated_at
       FROM team_members tm
       LEFT JOIN team_wfh_group_members gm ON gm.team_id = tm.team_id AND gm.member_email = tm.email
       WHERE tm.team_id = $1
       ORDER BY tm.role, tm.display_name NULLS LAST, tm.email`,
      [teamId],
    );
    return rows.map(mapGroupMember);
  },

  async upsertGroupAssignments(
    teamId: string,
    assignments: { email: string; groupCode: TeamWfhGroupCode }[],
    updatedByEmail: string,
  ): Promise<TeamWfhGroupMember[]> {
    const client = await getSharedClient();
    try {
      await client.query('BEGIN');

      if (assignments.length === 0) {
        await client.query('DELETE FROM team_wfh_group_members WHERE team_id = $1', [teamId]);
      } else {
        await client.query(
          `DELETE FROM team_wfh_group_members
           WHERE team_id = $1 AND NOT (member_email = ANY($2::text[]))`,
          [teamId, assignments.map((assignment) => assignment.email)],
        );
      }

      for (const assignment of assignments) {
        await client.query(
          `INSERT INTO team_wfh_group_members (team_id, member_email, group_code, updated_by_email)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT ON CONSTRAINT team_wfh_group_members_unique
           DO UPDATE SET group_code = EXCLUDED.group_code, updated_by_email = EXCLUDED.updated_by_email`,
          [teamId, assignment.email, assignment.groupCode, updatedByEmail],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.listGroupMembers(teamId);
  },

  async countSchedulesForYear(teamId: string, year: number): Promise<number> {
    const row = await queryOne<{ count: string }>(
      'SELECT COUNT(1) as count FROM team_wfh_schedules WHERE team_id = $1 AND generation_year = $2',
      [teamId, year],
    );
    return row ? parseInt(row.count, 10) : 0;
  },

  async replaceGeneratedSchedules(
    teamId: string,
    year: number,
    schedules: GeneratedScheduleInput[],
  ): Promise<ReplaceGeneratedSchedulesResult> {
    const client = await getSharedClient();
    let deletedCount = 0;
    const rows: ScheduleRow[] = [];

    try {
      await client.query('BEGIN');

      const deleteResult = await client.query(
        'DELETE FROM team_wfh_schedules WHERE team_id = $1 AND generation_year = $2',
        [teamId, year],
      );
      deletedCount = deleteResult.rowCount ?? 0;

      for (const schedule of schedules) {
        const result = await client.query<ScheduleRow>(
          `INSERT INTO team_wfh_schedules
             (team_id, group_code, original_date, schedule_date, status, conflict_holiday_id, generation_year, generated_by_email)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            schedule.teamId,
            schedule.groupCode,
            schedule.originalDate,
            schedule.scheduleDate,
            schedule.status,
            schedule.conflictHolidayId ?? null,
            schedule.generationYear,
            schedule.generatedByEmail,
          ],
        );
        rows.push(result.rows[0]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return {
      deletedCount,
      schedules: await mapSchedulesWithMembers(teamId, rows),
    };
  },

  async listSchedules(teamId: string, filters: ListScheduleFilters): Promise<TeamWfhSchedule[]> {
    const conditions = ['team_id = $1'];
    const values: unknown[] = [teamId];
    let parameterIndex = 2;

    if (filters.startDate) {
      conditions.push(`schedule_date >= $${parameterIndex}`);
      values.push(filters.startDate);
      parameterIndex += 1;
    }

    if (filters.endDate) {
      conditions.push(`schedule_date <= $${parameterIndex}`);
      values.push(filters.endDate);
      parameterIndex += 1;
    }

    if (filters.year) {
      conditions.push(`generation_year = $${parameterIndex}`);
      values.push(filters.year);
    }

    const rows = await query<ScheduleRow>(
      `SELECT * FROM team_wfh_schedules
       WHERE ${conditions.join(' AND ')}
       ORDER BY schedule_date ASC, group_code ASC`,
      values,
    );

    return mapSchedulesWithMembers(teamId, rows);
  },

  async getSchedule(teamId: string, scheduleId: string): Promise<TeamWfhSchedule | null> {
    const row = await queryOne<ScheduleRow>(
      'SELECT * FROM team_wfh_schedules WHERE team_id = $1 AND id = $2',
      [teamId, scheduleId],
    );
    if (!row) {
      return null;
    }
    const schedules = await mapSchedulesWithMembers(teamId, [row]);
    return schedules[0] ?? null;
  },

  async listChangeRequests(
    teamId: string,
    filters: ListChangeRequestFilters,
  ): Promise<PaginatedRepositoryResult<TeamWfhChangeRequest>> {
    const conditions = ['requests.team_id = $1'];
    const values: unknown[] = [teamId];
    let parameterIndex = 2;

    if (filters.status) {
      conditions.push(`requests.status = $${parameterIndex}`);
      values.push(filters.status);
      parameterIndex += 1;
    }

    if (filters.requesterEmail) {
      conditions.push(`requests.requester_email = $${parameterIndex}`);
      values.push(filters.requesterEmail);
      parameterIndex += 1;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(1) as count FROM team_wfh_change_requests requests ${whereClause}`,
      values,
    );
    const total = countRow ? parseInt(countRow.count, 10) : 0;
    const limit = filters.pageSize;
    const offset = (filters.page - 1) * filters.pageSize;

    const rows = await query<ChangeRequestRow>(
      `SELECT requests.*, members.display_name AS requester_display_name
       FROM team_wfh_change_requests requests
       LEFT JOIN team_members members ON members.team_id = requests.team_id AND members.email = requests.requester_email
       ${whereClause}
       ORDER BY requests.created_at DESC
       LIMIT $${parameterIndex} OFFSET $${parameterIndex + 1}`,
      [...values, limit, offset],
    );

    return {
      items: rows.map(mapChangeRequest),
      meta: buildPaginationMeta(total, filters.page, filters.pageSize),
    };
  },

  async getChangeRequest(teamId: string, requestId: string): Promise<TeamWfhChangeRequest | null> {
    const row = await queryOne<ChangeRequestRow>(
      `SELECT requests.*, members.display_name AS requester_display_name
       FROM team_wfh_change_requests requests
       LEFT JOIN team_members members ON members.team_id = requests.team_id AND members.email = requests.requester_email
       WHERE requests.team_id = $1 AND requests.id = $2`,
      [teamId, requestId],
    );
    return row ? mapChangeRequest(row) : null;
  },

  async findPendingChangeRequest(
    teamId: string,
    scheduleId: string,
    requesterEmail: string,
  ): Promise<TeamWfhChangeRequest | null> {
    const row = await queryOne<ChangeRequestRow>(
      `SELECT requests.*, members.display_name AS requester_display_name
       FROM team_wfh_change_requests requests
       LEFT JOIN team_members members ON members.team_id = requests.team_id AND members.email = requests.requester_email
       WHERE requests.team_id = $1 AND requests.schedule_id = $2 AND requests.requester_email = $3 AND requests.status = 'pending'`,
      [teamId, scheduleId, requesterEmail],
    );
    return row ? mapChangeRequest(row) : null;
  },

  async createChangeRequest(input: {
    teamId: string;
    scheduleId: string;
    requesterEmail: string;
    groupCode: TeamWfhGroupCode;
    originalDate: string;
    requestedDate: string;
    reason?: string;
  }): Promise<TeamWfhChangeRequest> {
    const row = await queryOne<ChangeRequestRow>(
      `INSERT INTO team_wfh_change_requests
         (team_id, schedule_id, requester_email, group_code, original_date, requested_date, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *, NULL::varchar AS requester_display_name`,
      [
        input.teamId,
        input.scheduleId,
        input.requesterEmail,
        input.groupCode,
        input.originalDate,
        input.requestedDate,
        input.reason ?? null,
      ],
    );

    return mapChangeRequest(row!);
  },

  async updateChangeRequestStatus(input: {
    teamId: string;
    requestId: string;
    status: Exclude<TeamWfhChangeRequestStatus, 'pending' | 'cancelled'>;
    approverEmail: string;
    decisionNote?: string;
  }): Promise<TeamWfhChangeRequest | null> {
    const row = await queryOne<ChangeRequestRow>(
      `UPDATE team_wfh_change_requests requests
       SET status = $3,
           approver_email = $4,
           decision_note = $5,
           decided_at = NOW()
       WHERE requests.team_id = $1 AND requests.id = $2
       RETURNING requests.*, (
         SELECT display_name FROM team_members members
         WHERE members.team_id = requests.team_id AND members.email = requests.requester_email
       ) AS requester_display_name`,
      [
        input.teamId,
        input.requestId,
        input.status,
        input.approverEmail,
        input.decisionNote ?? null,
      ],
    );
    return row ? mapChangeRequest(row) : null;
  },

  async listRawSchedulesForYear(teamId: string, year: number): Promise<RawScheduleForReapply[]> {
    const rows = await query<{
      id: string;
      group_code: TeamWfhGroupCode;
      original_date: string | Date;
      schedule_date: string | Date;
      status: TeamWfhScheduleStatus;
      conflict_holiday_id: string | null;
      generated_by_email: string;
    }>(
      `SELECT id, group_code, original_date, schedule_date, status, conflict_holiday_id, generated_by_email
       FROM team_wfh_schedules
       WHERE team_id = $1 AND generation_year = $2
       ORDER BY original_date ASC`,
      [teamId, year],
    );
    return rows.map((row) => ({
      id: row.id,
      groupCode: row.group_code,
      originalDate: toDateOnly(row.original_date),
      scheduleDate: toDateOnly(row.schedule_date),
      status: row.status,
      conflictHolidayId: row.conflict_holiday_id,
      generatedByEmail: row.generated_by_email,
    }));
  },

  async patchScheduleHolidayAdjustments(
    teamId: string,
    patches: ScheduleHolidayPatch[],
  ): Promise<void> {
    if (patches.length === 0) {
      return;
    }
    const client = await getSharedClient();
    try {
      await client.query('BEGIN');
      for (const patch of patches) {
        await client.query(
          `UPDATE team_wfh_schedules
           SET schedule_date = $3, status = $4, conflict_holiday_id = $5
           WHERE team_id = $1 AND id = $2`,
          [teamId, patch.id, patch.scheduleDate, patch.status, patch.conflictHolidayId],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async listApprovedRequestsByDateRange(
    teamId: string,
    startDate: string,
    endDate: string,
  ): Promise<TeamWfhChangeRequest[]> {
    const rows = await query<ChangeRequestRow>(
      `SELECT requests.*, members.display_name AS requester_display_name
       FROM team_wfh_change_requests requests
       LEFT JOIN team_members members ON members.team_id = requests.team_id AND members.email = requests.requester_email
       WHERE requests.team_id = $1
         AND requests.status = 'approved'
         AND requests.requested_date BETWEEN $2 AND $3
       ORDER BY requests.requested_date ASC, requests.created_at ASC`,
      [teamId, startDate, endDate],
    );
    return rows.map(mapChangeRequest);
  },
};
