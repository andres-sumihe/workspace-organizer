import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  TeamCalendarEventParams,
  TeamHolidayListParams,
  TeamWfhRequestParams,
  TeamWfhScheduleParams,
} from '@/features/team-calendar/api/team-calendar';
import type {
  CreateTeamPublicHolidayRequest,
  CreateTeamWfhChangeRequestRequest,
  DecideTeamWfhChangeRequestRequest,
  GenerateTeamWfhScheduleRequest,
  UpdateTeamPublicHolidayRequest,
  UpdateTeamWfhGroupMembersRequest,
} from '@workspace/shared';

import { teamCalendarApi } from '@/features/team-calendar/api/team-calendar';
import { queryKeys } from '@/lib/query-client';

const TEAM_CALENDAR_QUERY_OPTIONS = {
  staleTime: 5_000,
  refetchOnWindowFocus: true as const,
};

export function useTeamCalendarEvents(
  teamId: string | undefined,
  params: TeamCalendarEventParams | undefined,
) {
  return useQuery({
    queryKey: queryKeys.teamCalendar.events(
      teamId ?? '',
      params as Record<string, unknown> | undefined,
    ),
    queryFn: () => teamCalendarApi.getEvents(teamId!, params!),
    enabled: !!teamId && !!params?.startDate && !!params?.endDate,
    ...TEAM_CALENDAR_QUERY_OPTIONS,
  });
}

export function useTeamPublicHolidays(
  teamId: string | undefined,
  params: TeamHolidayListParams = {},
) {
  return useQuery({
    queryKey: queryKeys.teamCalendar.holidayList(teamId ?? '', params as Record<string, unknown>),
    queryFn: () => teamCalendarApi.listHolidays(teamId!, params),
    enabled: !!teamId,
    ...TEAM_CALENDAR_QUERY_OPTIONS,
  });
}

export function useTeamWfhGroupMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.teamCalendar.groups(teamId ?? ''),
    queryFn: () => teamCalendarApi.listGroupMembers(teamId!),
    enabled: !!teamId,
    ...TEAM_CALENDAR_QUERY_OPTIONS,
  });
}

export function useTeamWfhSchedules(
  teamId: string | undefined,
  params: TeamWfhScheduleParams = {},
) {
  return useQuery({
    queryKey: queryKeys.teamCalendar.scheduleList(teamId ?? '', params as Record<string, unknown>),
    queryFn: () => teamCalendarApi.listSchedules(teamId!, params),
    enabled: !!teamId,
    ...TEAM_CALENDAR_QUERY_OPTIONS,
  });
}

export function useTeamWfhChangeRequests(
  teamId: string | undefined,
  params: TeamWfhRequestParams = {},
) {
  return useQuery({
    queryKey: queryKeys.teamCalendar.requestList(teamId ?? '', params as Record<string, unknown>),
    queryFn: () => teamCalendarApi.listChangeRequests(teamId!, params),
    enabled: !!teamId,
    ...TEAM_CALENDAR_QUERY_OPTIONS,
  });
}

export function useCreateTeamPublicHoliday(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTeamPublicHolidayRequest) =>
      teamCalendarApi.createHoliday(teamId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.holidays() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.all });
    },
  });
}

export function useUpdateTeamPublicHoliday(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      holidayId,
      payload,
    }: {
      holidayId: string;
      payload: UpdateTeamPublicHolidayRequest;
    }) => teamCalendarApi.updateHoliday(teamId, holidayId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.holidays() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.all });
    },
  });
}

export function useDeleteTeamPublicHoliday(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (holidayId: string) => teamCalendarApi.deleteHoliday(teamId, holidayId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.holidays() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.all });
    },
  });
}

export function useUpdateTeamWfhGroupMembers(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateTeamWfhGroupMembersRequest) =>
      teamCalendarApi.updateGroupMembers(teamId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.groups(teamId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.schedules() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.all });
    },
  });
}

export function useGenerateTeamWfhSchedule(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: GenerateTeamWfhScheduleRequest) =>
      teamCalendarApi.generateSchedule(teamId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.schedules() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.all });
    },
  });
}

export function useCreateTeamWfhChangeRequest(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTeamWfhChangeRequestRequest) =>
      teamCalendarApi.createChangeRequest(teamId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.requests() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.all });
    },
  });
}

export function useApproveTeamWfhChangeRequest(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      payload,
    }: {
      requestId: string;
      payload: DecideTeamWfhChangeRequestRequest;
    }) => teamCalendarApi.approveChangeRequest(teamId, requestId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.requests() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.schedules() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.all });
    },
  });
}

export function useRejectTeamWfhChangeRequest(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      requestId,
      payload,
    }: {
      requestId: string;
      payload: DecideTeamWfhChangeRequestRequest;
    }) => teamCalendarApi.rejectChangeRequest(teamId, requestId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.requests() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teamCalendar.all });
    },
  });
}
