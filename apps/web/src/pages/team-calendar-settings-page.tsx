import {
  AlertCircle,
  CalendarDays,
  Check,
  Loader2,
  Save,
  Search,
  Trash2,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type { TeamWfhChangeRequestStatus, TeamWfhGroupCode } from '@workspace/shared';

import { AppPage, AppPageContent, AppPageTabs } from '@/components/layout/app-page';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useMode } from '@/contexts/mode-context';
import {
  useApproveTeamWfhChangeRequest,
  useCreateTeamPublicHoliday,
  useDeleteTeamPublicHoliday,
  useGenerateTeamWfhSchedule,
  useRejectTeamWfhChangeRequest,
  useTeamPublicHolidays,
  useTeamWfhChangeRequests,
  useTeamWfhGroupMembers,
  useUpdateTeamWfhGroupMembers,
} from '@/features/team-calendar';
import { useTeamEventStream } from '@/features/team-projects';
import { useCurrentTeam } from '@/features/teams/hooks/use-current-team';

const groupCodes: TeamWfhGroupCode[] = ['A', 'B', 'C', 'D'];

const getCurrentYear = (): number => new Date().getFullYear();

const formatDate = (dateText?: string): string => {
  if (!dateText) return '-';
  return new Date(`${dateText}T00:00:00.000Z`).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const getCurrentWeekMonday = (): string => {
  const today = new Date();
  const utcToday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const dayOfWeek = utcToday.getUTCDay() === 0 ? 7 : utcToday.getUTCDay();
  utcToday.setUTCDate(utcToday.getUTCDate() + 1 - dayOfWeek);
  return utcToday.toISOString().slice(0, 10);
};

const canManageCalendar = (role?: string): boolean => role === 'admin' || role === 'owner';

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

function CalendarPermissionNotice() {
  return (
    <Alert variant="warning">
      <AlertCircle className="size-4" />
      <AlertDescription>Only team owners and admins can change these settings.</AlertDescription>
    </Alert>
  );
}

interface HolidaySettingsSectionProps {
  teamId: string;
  canManage: boolean;
}

function HolidaySettingsSection({ teamId, canManage }: HolidaySettingsSectionProps) {
  const [search, setSearch] = useState('');
  const [year, setYear] = useState(String(getCurrentYear()));
  const [month, setMonth] = useState('all');
  const [reduceFilter, setReduceFilter] = useState('all');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isRange, setIsRange] = useState(false);
  const [reducesAnnualLeave, setReducesAnnualLeave] = useState(false);

  const holidayParams = useMemo(
    () => ({
      page: 1,
      pageSize: 100,
      search: search || undefined,
      year: year ? Number(year) : undefined,
      month: month === 'all' ? undefined : Number(month),
      reducesAnnualLeave: reduceFilter === 'all' ? undefined : reduceFilter === 'true',
    }),
    [month, reduceFilter, search, year],
  );

  const holidaysQuery = useTeamPublicHolidays(teamId, holidayParams);
  const createHoliday = useCreateTeamPublicHoliday(teamId);
  const deleteHoliday = useDeleteTeamPublicHoliday(teamId);
  const holidays = holidaysQuery.data?.items ?? [];
  const isHolidaySchemaBlocked = holidaysQuery.isError;

  const resetForm = () => {
    setName('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setIsRange(false);
    setReducesAnnualLeave(false);
  };

  const handleCreateHoliday = async () => {
    try {
      await createHoliday.mutateAsync({
        name,
        description: description || undefined,
        startDate,
        endDate: isRange ? endDate : undefined,
        isRange,
        reducesAnnualLeave,
      });
      toast.success('Holiday saved');
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save holiday');
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    try {
      await deleteHoliday.mutateAsync(holidayId);
      toast.success('Holiday deleted');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete holiday');
    }
  };

  return (
    <div className="space-y-4">
      {!canManage ? <CalendarPermissionNotice /> : null}
      {holidaysQuery.isError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {getErrorMessage(holidaysQuery.error, 'Failed to load public holidays')}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Public Holiday</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Holiday Name</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!canManage}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                disabled={!canManage}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <DatePicker value={startDate} onChange={setStartDate} disabled={!canManage} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={isRange}
                onCheckedChange={(checked) => setIsRange(checked === true)}
                disabled={!canManage}
              />
              Range date
            </label>
            {isRange ? (
              <div className="space-y-2">
                <Label>End Date</Label>
                <DatePicker value={endDate} onChange={setEndDate} disabled={!canManage} />
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={reducesAnnualLeave}
                onCheckedChange={(checked) => setReducesAnnualLeave(checked === true)}
                disabled={!canManage}
              />
              Is reduce annual leave for joint holiday?
            </label>
            <Button
              className="w-full"
              onClick={handleCreateHoliday}
              disabled={
                !canManage ||
                isHolidaySchemaBlocked ||
                !name.trim() ||
                !startDate ||
                createHoliday.isPending
              }
            >
              {createHoliday.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CalendarDays className="size-4" />
              )}
              Save Holiday
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Public Holidays</CardTitle>
              {holidaysQuery.isFetching ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[minmax(0,1fr)_120px_140px] gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                  placeholder="Search"
                />
              </div>
              <Input
                value={year}
                onChange={(event) => setYear(event.target.value)}
                inputMode="numeric"
              />
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All months</SelectItem>
                  {Array.from({ length: 12 }, (_unused, monthIndex) => (
                    <SelectItem key={monthIndex + 1} value={String(monthIndex + 1)}>
                      {new Date(Date.UTC(2026, monthIndex, 1)).toLocaleDateString('en-US', {
                        month: 'short',
                        timeZone: 'UTC',
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={reduceFilter} onValueChange={setReduceFilter}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All leave settings</SelectItem>
                <SelectItem value="true">Reduce annual leave</SelectItem>
                <SelectItem value="false">No annual leave reduction</SelectItem>
              </SelectContent>
            </Select>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Joint Leave</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((holiday) => (
                    <TableRow key={holiday.id}>
                      <TableCell>
                        <div className="font-medium">{holiday.name}</div>
                        {holiday.description ? (
                          <div className="text-xs text-muted-foreground">{holiday.description}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>{formatDate(holiday.holidayDate)}</TableCell>
                      <TableCell>
                        {holiday.reducesAnnualLeave ? (
                          <Badge variant="warning">Yes</Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteHoliday(holiday.id)}
                          disabled={!canManage || deleteHoliday.isPending}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {holidays.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No holidays found
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface WfhSettingsSectionProps {
  teamId: string;
  canManage: boolean;
}

function WfhSettingsSection({ teamId, canManage }: WfhSettingsSectionProps) {
  const navigate = useNavigate();
  const membersQuery = useTeamWfhGroupMembers(teamId);
  const updateMembers = useUpdateTeamWfhGroupMembers(teamId);
  const generateSchedule = useGenerateTeamWfhSchedule(teamId);
  const [assignments, setAssignments] = useState<Record<string, TeamWfhGroupCode | ''>>({});
  const [year, setYear] = useState(String(getCurrentYear()));
  const [weekStartDate, setWeekStartDate] = useState(getCurrentWeekMonday());
  const [mondayGroupCode, setMondayGroupCode] = useState<TeamWfhGroupCode>('A');
  const [regenerate, setRegenerate] = useState(false);
  const members = membersQuery.data?.members ?? [];
  const assignedMemberCount = Object.values(assignments).filter(Boolean).length;

  useEffect(() => {
    const nextAssignments: Record<string, TeamWfhGroupCode | ''> = {};
    for (const member of membersQuery.data?.members ?? []) {
      nextAssignments[member.email] = member.groupCode ?? '';
    }
    setAssignments(nextAssignments);
  }, [membersQuery.data?.members]);

  const handleSaveAssignments = async () => {
    const payloadAssignments = Object.entries(assignments)
      .filter(
        (assignmentEntry): assignmentEntry is [string, TeamWfhGroupCode] =>
          assignmentEntry[1] !== '',
      )
      .map(([email, groupCode]) => ({ email, groupCode }));

    try {
      await updateMembers.mutateAsync({ assignments: payloadAssignments });
      toast.success('WFH groups saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save WFH groups');
    }
  };

  const handleGenerate = async () => {
    try {
      const response = await generateSchedule.mutateAsync({
        year: Number(year),
        weekStartDate,
        mondayGroupCode,
        regenerate,
      });
      toast.success(`Generated ${response.result.createdCount} WFH schedules`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate WFH schedule');
    }
  };

  return (
    <div className="space-y-4">
      {!canManage ? <CalendarPermissionNotice /> : null}
      {membersQuery.isError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {getErrorMessage(membersQuery.error, 'Failed to load WFH group members')}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">WFH Group Members</CardTitle>
              {membersQuery.isFetching ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-40">Group</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.email}>
                      <TableCell>
                        <div className="font-medium">{member.displayName ?? member.email}</div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={assignments[member.email] || 'unassigned'}
                          onValueChange={(value) =>
                            setAssignments((current) => ({
                              ...current,
                              [member.email]:
                                value === 'unassigned' ? '' : (value as TeamWfhGroupCode),
                            }))
                          }
                          disabled={!canManage}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {groupCodes.map((groupCode) => (
                              <SelectItem key={groupCode} value={groupCode}>
                                Team {groupCode}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {members.length === 0 && !membersQuery.isLoading && !membersQuery.isError ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8">
                        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                          <span>No team members found.</span>
                          <Button variant="outline" size="sm" onClick={() => navigate('/teams')}>
                            <Users className="size-4" />
                            Open Members
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
            <Button
              onClick={handleSaveAssignments}
              disabled={
                !canManage ||
                membersQuery.isError ||
                members.length === 0 ||
                updateMembers.isPending
              }
            >
              {updateMembers.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save Groups
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">WFH Generator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                value={year}
                onChange={(event) => setYear(event.target.value)}
                inputMode="numeric"
                disabled={!canManage}
              />
            </div>
            <div className="space-y-2">
              <Label>Current Week Monday</Label>
              <DatePicker value={weekStartDate} onChange={setWeekStartDate} disabled={!canManage} />
            </div>
            <div className="space-y-2">
              <Label>Monday WFH Group</Label>
              <Select
                value={mondayGroupCode}
                onValueChange={(value) => setMondayGroupCode(value as TeamWfhGroupCode)}
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groupCodes.map((groupCode) => (
                    <SelectItem key={groupCode} value={groupCode}>
                      Team {groupCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={regenerate}
                onCheckedChange={(checked) => setRegenerate(checked === true)}
                disabled={!canManage}
              />
              Regenerate existing year
            </label>
            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={
                !canManage ||
                membersQuery.isError ||
                assignedMemberCount === 0 ||
                !weekStartDate ||
                generateSchedule.isPending
              }
            >
              {generateSchedule.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              Generate Schedule
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface RequestSettingsSectionProps {
  teamId: string;
  canManage: boolean;
}

function RequestSettingsSection({ teamId, canManage }: RequestSettingsSectionProps) {
  const [status, setStatus] = useState<TeamWfhChangeRequestStatus | 'all'>('pending');
  const requestsQuery = useTeamWfhChangeRequests(teamId, {
    page: 1,
    pageSize: 100,
    status: status === 'all' ? undefined : status,
  });
  const approveRequest = useApproveTeamWfhChangeRequest(teamId);
  const rejectRequest = useRejectTeamWfhChangeRequest(teamId);

  const handleApprove = async (requestId: string) => {
    try {
      await approveRequest.mutateAsync({ requestId, payload: {} });
      toast.success('Request approved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve request');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await rejectRequest.mutateAsync({ requestId, payload: {} });
      toast.success('Request rejected');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject request');
    }
  };

  return (
    <div className="space-y-4">
      {!canManage ? <CalendarPermissionNotice /> : null}
      {requestsQuery.isError ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            {getErrorMessage(requestsQuery.error, 'Failed to load WFH change requests')}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">WFH Change Requests</CardTitle>
            <div className="flex items-center gap-2">
              {requestsQuery.isFetching ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : null}
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as TeamWfhChangeRequestStatus | 'all')}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requester</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Original</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(requestsQuery.data?.items ?? []).map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="font-medium">
                        {request.requesterDisplayName ?? request.requesterEmail}
                      </div>
                      {request.reason ? (
                        <div className="text-xs text-muted-foreground">{request.reason}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>Team {request.groupCode}</TableCell>
                    <TableCell>{formatDate(request.originalDate)}</TableCell>
                    <TableCell>{formatDate(request.requestedDate)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          request.status === 'approved'
                            ? 'success'
                            : request.status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {request.status === 'pending' && canManage ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleApprove(request.id)}
                            disabled={approveRequest.isPending}
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleReject(request.id)}
                            disabled={rejectRequest.isPending}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
                {(requestsQuery.data?.items ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No requests found
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const TeamCalendarSettingsPage = () => {
  const navigate = useNavigate();
  const { isSoloMode, isSharedMode } = useMode();
  const currentTeamQuery = useCurrentTeam(isSharedMode);
  const currentTeam = currentTeamQuery.data;
  const teamId = currentTeam?.team.id;
  const canManage = canManageCalendar(currentTeam?.membership.role);

  useTeamEventStream(teamId);

  if (isSoloMode) {
    return (
      <AppPage title="Team Settings" description="Shared mode required">
        <AppPageContent className="flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader className="text-center">
              <Users className="mx-auto mb-3 size-10 text-muted-foreground" />
              <CardTitle>Team Settings Unavailable</CardTitle>
            </CardHeader>
          </Card>
        </AppPageContent>
      </AppPage>
    );
  }

  if (currentTeamQuery.isLoading) {
    return (
      <AppPage title="Team Settings">
        <AppPageContent className="flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </AppPageContent>
      </AppPage>
    );
  }

  if (!currentTeam || !teamId) {
    return (
      <AppPage title="Team Settings">
        <AppPageContent>
          <Alert>
            <AlertCircle className="size-4" />
            <AlertDescription>Create or join a team before opening team settings.</AlertDescription>
          </Alert>
        </AppPageContent>
      </AppPage>
    );
  }

  return (
    <AppPage
      title="Team Settings"
      description={currentTeam.team.name}
      actions={
        <Button variant="outline" onClick={() => navigate('/team-calendar')}>
          <CalendarDays className="size-4" />
          Calendar
        </Button>
      }
    >
      <Tabs defaultValue="holidays" className="flex min-h-0 flex-1 flex-col">
        <AppPageTabs
          tabs={
            <TabsList>
              <TabsTrigger value="holidays">Public Holidays</TabsTrigger>
              <TabsTrigger value="wfh">WFH Settings</TabsTrigger>
              <TabsTrigger value="requests">Requests</TabsTrigger>
            </TabsList>
          }
        >
          <TabsContent value="holidays" className="m-0 flex-1 overflow-auto p-6">
            <HolidaySettingsSection teamId={teamId} canManage={canManage} />
          </TabsContent>
          <TabsContent value="wfh" className="m-0 flex-1 overflow-auto p-6">
            <WfhSettingsSection teamId={teamId} canManage={canManage} />
          </TabsContent>
          <TabsContent value="requests" className="m-0 flex-1 overflow-auto p-6">
            <RequestSettingsSection teamId={teamId} canManage={canManage} />
          </TabsContent>
        </AppPageTabs>
      </Tabs>
    </AppPage>
  );
};
