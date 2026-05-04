import type {
  CreateTeamPublicHolidayRequest,
  CreateTeamWfhChangeRequestRequest,
  DecideTeamWfhChangeRequestRequest,
  GenerateTeamWfhScheduleRequest,
  TeamCalendarEventsResponse,
  TeamPublicHoliday,
  TeamPublicHolidayListResponse,
  TeamPublicHolidayResponse,
  TeamWfhChangeRequestListResponse,
  TeamWfhChangeRequestResponse,
  TeamWfhChangeRequestStatus,
  TeamWfhGroupMembersResponse,
  TeamWfhScheduleGenerationResponse,
  TeamWfhScheduleListResponse,
  UpdateTeamPublicHolidayRequest,
  UpdateTeamWfhGroupMembersRequest,
} from '@workspace/shared';

import { apiClient } from '@/api/client';

export interface TeamHolidayListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  year?: number;
  month?: number;
  reducesAnnualLeave?: boolean;
}

export interface TeamWfhScheduleParams {
  startDate?: string;
  endDate?: string;
  year?: number;
}

export interface TeamWfhRequestParams {
  page?: number;
  pageSize?: number;
  status?: TeamWfhChangeRequestStatus;
}

export interface TeamCalendarEventParams {
  startDate: string;
  endDate: string;
}

export interface CreateTeamPublicHolidayResponse {
  holidays: TeamPublicHoliday[];
}

const basePath = (teamId: string) => `/api/v1/teams/${teamId}/calendar`;

export const teamCalendarApi = {
  listHolidays(teamId: string, params: TeamHolidayListParams = {}) {
    return apiClient.get<TeamPublicHolidayListResponse>(`${basePath(teamId)}/holidays`, {
      query: { ...params },
    });
  },

  createHoliday(teamId: string, payload: CreateTeamPublicHolidayRequest) {
    return apiClient.post<CreateTeamPublicHolidayResponse>(`${basePath(teamId)}/holidays`, payload);
  },

  updateHoliday(teamId: string, holidayId: string, payload: UpdateTeamPublicHolidayRequest) {
    return apiClient.put<TeamPublicHolidayResponse>(
      `${basePath(teamId)}/holidays/${holidayId}`,
      payload,
    );
  },

  deleteHoliday(teamId: string, holidayId: string) {
    return apiClient.delete<void>(`${basePath(teamId)}/holidays/${holidayId}`);
  },

  listGroupMembers(teamId: string) {
    return apiClient.get<TeamWfhGroupMembersResponse>(`${basePath(teamId)}/wfh/groups`);
  },

  updateGroupMembers(teamId: string, payload: UpdateTeamWfhGroupMembersRequest) {
    return apiClient.put<TeamWfhGroupMembersResponse>(
      `${basePath(teamId)}/wfh/groups/members`,
      payload,
    );
  },

  generateSchedule(teamId: string, payload: GenerateTeamWfhScheduleRequest) {
    return apiClient.post<TeamWfhScheduleGenerationResponse>(
      `${basePath(teamId)}/wfh/generate`,
      payload,
    );
  },

  listSchedules(teamId: string, params: TeamWfhScheduleParams = {}) {
    return apiClient.get<TeamWfhScheduleListResponse>(`${basePath(teamId)}/wfh/schedules`, {
      query: { ...params },
    });
  },

  listChangeRequests(teamId: string, params: TeamWfhRequestParams = {}) {
    return apiClient.get<TeamWfhChangeRequestListResponse>(
      `${basePath(teamId)}/wfh/change-requests`,
      { query: { ...params } },
    );
  },

  createChangeRequest(teamId: string, payload: CreateTeamWfhChangeRequestRequest) {
    return apiClient.post<TeamWfhChangeRequestResponse>(
      `${basePath(teamId)}/wfh/change-requests`,
      payload,
    );
  },

  approveChangeRequest(
    teamId: string,
    requestId: string,
    payload: DecideTeamWfhChangeRequestRequest,
  ) {
    return apiClient.post<TeamWfhChangeRequestResponse>(
      `${basePath(teamId)}/wfh/change-requests/${requestId}/approve`,
      payload,
    );
  },

  rejectChangeRequest(
    teamId: string,
    requestId: string,
    payload: DecideTeamWfhChangeRequestRequest,
  ) {
    return apiClient.post<TeamWfhChangeRequestResponse>(
      `${basePath(teamId)}/wfh/change-requests/${requestId}/reject`,
      payload,
    );
  },

  getEvents(teamId: string, params: TeamCalendarEventParams) {
    return apiClient.get<TeamCalendarEventsResponse>(`${basePath(teamId)}/events`, {
      query: { ...params },
    });
  },
};
