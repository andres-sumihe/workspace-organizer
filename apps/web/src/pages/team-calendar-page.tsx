import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Settings,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type { TeamCalendarDay, TeamWfhSchedule } from '@workspace/shared';

import { AppPage, AppPageContent } from '@/components/layout/app-page';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useMode } from '@/contexts/mode-context';
import { useCreateTeamWfhChangeRequest, useTeamCalendarEvents } from '@/features/team-calendar';
import { useTeamEventStream } from '@/features/team-projects';
import { useCurrentTeam } from '@/features/teams/hooks/use-current-team';
import { cn } from '@/lib/utils';

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const formatDateKey = (date: Date): string => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number): Date => {
  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
};

const startOfMonth = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const endOfMonth = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));

const getMondayGridStart = (date: Date): Date => {
  const dayOfWeek = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  return addDays(date, 1 - dayOfWeek);
};

const getSundayGridEnd = (date: Date): Date => {
  const dayOfWeek = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  return addDays(date, 7 - dayOfWeek);
};

const getMonthTitle = (date: Date): string =>
  date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const getDisplayDate = (dateText: string): string => {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const getDayNumber = (date: Date): string => String(date.getUTCDate());

const isSameMonth = (date: Date, visibleMonth: Date): boolean =>
  date.getUTCFullYear() === visibleMonth.getUTCFullYear() &&
  date.getUTCMonth() === visibleMonth.getUTCMonth();

const isToday = (date: Date): boolean => formatDateKey(date) === formatDateKey(new Date());

interface RequestDialogState {
  schedule: TeamWfhSchedule;
  requestedDate: string;
  reason: string;
}

interface DayCellProps {
  day: TeamCalendarDay;
  calendarDate: Date;
  visibleMonth: Date;
  onRequestChange: (schedule: TeamWfhSchedule) => void;
}

const MAX_VISIBLE_EVENTS = 2;

function DayCell({ day, calendarDate, visibleMonth, onRequestChange }: DayCellProps) {
  const totalEvents = day.holidays.length + day.wfhSchedules.length + day.approvedRequests.length;

  // Build visible items: holidays first, then WFH schedules, then approved requests
  const visibleHolidays = day.holidays.slice(0, MAX_VISIBLE_EVENTS);
  const remainingSlots = MAX_VISIBLE_EVENTS - visibleHolidays.length;
  const visibleSchedules = day.wfhSchedules.slice(0, remainingSlots);
  const remainingAfterSchedules = remainingSlots - visibleSchedules.length;
  const visibleRequests = day.approvedRequests.slice(0, remainingAfterSchedules);
  const overflowCount =
    totalEvents - visibleHolidays.length - visibleSchedules.length - visibleRequests.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'min-h-24 border-r border-b border-border p-2 text-left transition-colors hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring',
            !isSameMonth(calendarDate, visibleMonth) && 'bg-muted/30 text-muted-foreground',
            isToday(calendarDate) && 'bg-primary/5',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-sm',
                isToday(calendarDate) && 'bg-primary text-primary-foreground',
              )}
            >
              {getDayNumber(calendarDate)}
            </span>
            {totalEvents > 0 && day.holidays.length > 0 ? (
              <span className="size-1.5 rounded-full bg-warning" />
            ) : null}
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {visibleHolidays.map((holiday) => (
              <span key={holiday.id} className="flex items-center gap-1 text-xs text-foreground">
                <span className="size-1.5 shrink-0 rounded-full bg-warning" />
                <span className="truncate leading-tight">{holiday.name}</span>
              </span>
            ))}
            {visibleSchedules.map((schedule) => (
              <span key={schedule.id} className="flex items-center gap-1 text-xs text-foreground">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {schedule.groupCode}
                </span>
                <span className="truncate leading-tight">Team {schedule.groupCode}</span>
              </span>
            ))}
            {visibleRequests.map((request) => (
              <span key={request.id} className="flex items-center gap-1 text-xs text-foreground">
                <span className="size-1.5 shrink-0 rounded-full bg-success" />
                <span className="truncate leading-tight">
                  {request.requesterDisplayName ?? request.requesterEmail}
                </span>
              </span>
            ))}
            {overflowCount > 0 ? (
              <span className="text-[10px] leading-tight text-muted-foreground">
                +{overflowCount} more
              </span>
            ) : null}
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold">{getDisplayDate(day.date)}</p>
            {totalEvents === 0 ? (
              <p className="text-sm text-muted-foreground">No team calendar items</p>
            ) : null}
          </div>
          {day.holidays.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">Public Holidays</p>
              {day.holidays.map((holiday) => (
                <div key={holiday.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{holiday.name}</p>
                    {holiday.reducesAnnualLeave ? (
                      <Badge variant="warning">Joint leave</Badge>
                    ) : null}
                  </div>
                  {holiday.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{holiday.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {day.wfhSchedules.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">WFH Schedule</p>
              {day.wfhSchedules.map((schedule) => (
                <div key={schedule.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                        {schedule.groupCode}
                      </span>
                      <div>
                        <p className="font-medium">Team {schedule.groupCode}</p>
                        {schedule.status === 'rescheduled' ? (
                          <p className="text-xs text-muted-foreground">
                            Moved from {getDisplayDate(schedule.originalDate)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => onRequestChange(schedule)}>
                      Request
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {schedule.members.length > 0 ? (
                      schedule.members.map((member) => (
                        <Badge key={member.email} variant="secondary">
                          {member.displayName ?? member.email}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No assigned members</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {day.approvedRequests.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Approved Changes
              </p>
              {day.approvedRequests.map((request) => (
                <div key={request.id} className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium">
                    {request.requesterDisplayName ?? request.requesterEmail}
                  </p>
                  <p className="text-muted-foreground">
                    Team {request.groupCode}, moved from {getDisplayDate(request.originalDate)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const TeamCalendarPage = () => {
  const navigate = useNavigate();
  const { isSoloMode, isSharedMode } = useMode();
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [requestDialog, setRequestDialog] = useState<RequestDialogState | null>(null);
  const currentTeamQuery = useCurrentTeam(isSharedMode);
  const currentTeam = currentTeamQuery.data;
  const teamId = currentTeam?.team.id;

  useTeamEventStream(teamId);

  const gridDates = useMemo(() => {
    const gridStart = getMondayGridStart(startOfMonth(visibleMonth));
    const gridEnd = getSundayGridEnd(endOfMonth(visibleMonth));
    const dates: Date[] = [];
    let calendarDate = gridStart;
    while (calendarDate.getTime() <= gridEnd.getTime()) {
      dates.push(calendarDate);
      calendarDate = addDays(calendarDate, 1);
    }
    return dates;
  }, [visibleMonth]);

  const eventRange = useMemo(
    () => ({
      startDate: formatDateKey(gridDates[0]),
      endDate: formatDateKey(gridDates[gridDates.length - 1]),
    }),
    [gridDates],
  );

  const eventsQuery = useTeamCalendarEvents(teamId, eventRange);
  const createRequestMutation = useCreateTeamWfhChangeRequest(teamId ?? '');

  const daysByDate = useMemo(() => {
    const sourceDays = eventsQuery.data?.days ?? [];
    return new Map(sourceDays.map((day) => [day.date, day]));
  }, [eventsQuery.data?.days]);

  const handlePreviousMonth = () => {
    setVisibleMonth(
      (currentMonth) =>
        new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - 1, 1)),
    );
  };

  const handleNextMonth = () => {
    setVisibleMonth(
      (currentMonth) =>
        new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1, 1)),
    );
  };

  const handleRequestSubmit = async () => {
    if (!requestDialog || !teamId) {
      return;
    }

    try {
      await createRequestMutation.mutateAsync({
        scheduleId: requestDialog.schedule.id,
        requestedDate: requestDialog.requestedDate,
        reason: requestDialog.reason.trim() || undefined,
      });
      toast.success('WFH change request submitted');
      setRequestDialog(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit request');
    }
  };

  if (isSoloMode) {
    return (
      <AppPage title="Team Calendar" description="Shared mode required">
        <AppPageContent className="flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader className="text-center">
              <Users className="mx-auto mb-3 size-10 text-muted-foreground" />
              <CardTitle>Team Calendar Unavailable</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground">
              Enable Shared mode in Settings to use team calendar schedules.
            </CardContent>
          </Card>
        </AppPageContent>
      </AppPage>
    );
  }

  if (currentTeamQuery.isLoading) {
    return (
      <AppPage title="Team Calendar">
        <AppPageContent className="flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </AppPageContent>
      </AppPage>
    );
  }

  if (!currentTeam) {
    return (
      <AppPage title="Team Calendar">
        <AppPageContent>
          <Alert>
            <AlertCircle className="size-4" />
            <AlertDescription>Create or join a team before opening the calendar.</AlertDescription>
          </Alert>
        </AppPageContent>
      </AppPage>
    );
  }

  return (
    <AppPage
      title="Team Calendar"
      description={currentTeam.team.name}
      actions={
        <Button variant="outline" onClick={() => navigate('/team-calendar/settings')}>
          <Settings className="size-4" />
          Settings
        </Button>
      }
    >
      <AppPageContent className="flex justify-center bg-muted/20">
        <div className="w-full max-w-270 space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <CalendarDays className="size-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{getMonthTitle(visibleMonth)}</h2>
              {eventsQuery.isFetching ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" onClick={() => setVisibleMonth(startOfMonth(new Date()))}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {eventsQuery.error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                {eventsQuery.error instanceof Error
                  ? eventsQuery.error.message
                  : 'Failed to load calendar'}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="grid grid-cols-7 border-b border-border bg-muted/60">
              {weekdayLabels.map((weekday) => (
                <div
                  key={weekday}
                  className="px-3 py-2 text-center text-xs font-medium uppercase text-muted-foreground"
                >
                  {weekday}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {gridDates.map((calendarDate) => {
                const dateKey = formatDateKey(calendarDate);
                const day = daysByDate.get(dateKey) ?? {
                  date: dateKey,
                  holidays: [],
                  wfhSchedules: [],
                  approvedRequests: [],
                };
                return (
                  <DayCell
                    key={dateKey}
                    day={day}
                    calendarDate={calendarDate}
                    visibleMonth={visibleMonth}
                    onRequestChange={(schedule) =>
                      setRequestDialog({
                        schedule,
                        requestedDate: schedule.scheduleDate,
                        reason: '',
                      })
                    }
                  />
                );
              })}
            </div>
          </div>
        </div>
      </AppPageContent>

      <Dialog open={!!requestDialog} onOpenChange={(open) => !open && setRequestDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request WFH Change</DialogTitle>
          </DialogHeader>
          {requestDialog ? (
            <div className="space-y-4">
              <div className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">Team {requestDialog.schedule.groupCode}</p>
                <p className="text-muted-foreground">
                  Current date: {getDisplayDate(requestDialog.schedule.scheduleDate)}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Requested Date</Label>
                <DatePicker
                  value={requestDialog.requestedDate}
                  onChange={(requestedDate) =>
                    setRequestDialog({ ...requestDialog, requestedDate })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={requestDialog.reason}
                  onChange={(event) =>
                    setRequestDialog({ ...requestDialog, reason: event.target.value })
                  }
                  rows={4}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleRequestSubmit}
              disabled={!requestDialog?.requestedDate || createRequestMutation.isPending}
            >
              {createRequestMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppPage>
  );
};
