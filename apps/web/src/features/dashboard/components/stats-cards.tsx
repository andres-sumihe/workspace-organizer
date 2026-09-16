import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  DollarSign,
  Flame,
  Settings2,
  Zap
} from 'lucide-react';
import { useMemo, type ReactNode } from 'react';

import { toolsApi } from '@/api/tools';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { workLogsApi } from '@/features/journal/api/journal';
import { settingsApi } from '@/features/settings/api/settings';
import { queryKeys } from '@/lib/query-client';
import { cn } from '@/lib/utils';

const STALE_TIME = 2 * 60 * 1000; // 2 minutes

interface StatCellProps {
  label: string;
  icon?: ReactNode;
  extra?: ReactNode;
  value: ReactNode;
  hint: string;
  loading?: boolean;
}

const StatCell = ({ label, icon, extra, value, hint, loading }: StatCellProps) => (
  <div className="flex min-w-0 flex-col gap-2 px-5 py-4">
    <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
      <span className="truncate">{label}</span>
      <span className="flex items-center gap-1 [&_svg]:size-4">
        {extra}
        {icon}
      </span>
    </div>
    {loading ? (
      <Skeleton className="h-7 w-24" />
    ) : (
      <div className="truncate text-2xl font-semibold tabular-nums tracking-[-0.02em]">{value}</div>
    )}
    <p className="truncate text-xs text-muted-foreground">{hint}</p>
  </div>
);

// ============================================================================
// Monthly Overtime Card
// ============================================================================
export const OvertimeStatCard = () => {
  const monthStartStr = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  }, []);

  const { data: overtimeStats, isLoading } = useQuery({
    queryKey: queryKeys.overtime.stats({ from: monthStartStr }),
    queryFn: () => toolsApi.getOvertimeStatistics({ from: monthStartStr }),
    staleTime: STALE_TIME,
    placeholderData: (prev) => prev,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <StatCell
      label="Monthly overtime"
      icon={<DollarSign />}
      loading={isLoading && !overtimeStats}
      value={formatCurrency(overtimeStats?.totalPay ?? 0)}
      hint={`${overtimeStats?.totalHours ?? 0} hours recorded this month`}
    />
  );
};

// ============================================================================
// Tasks Completed This Week Card
// ============================================================================
export const TasksCompletedCard = () => {
  const { weekStartStr, weekEndStr, sixtyDaysAgoStr } = useMemo(() => {
    const now = new Date();
    const dist = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dist);
    
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    return {
      weekStartStr: weekStart.toISOString().split('T')[0],
      weekEndStr: weekEnd.toISOString().split('T')[0],
      sixtyDaysAgoStr: sixtyDaysAgo.toISOString().split('T')[0]
    };
  }, []);

  const { data: historyRes, isLoading } = useQuery({
    queryKey: queryKeys.workLogs.list({ from: sixtyDaysAgoStr }),
    queryFn: () => workLogsApi.list({ from: sixtyDaysAgoStr }),
    staleTime: STALE_TIME,
    placeholderData: (prev) => prev,
  });

  const completedThisWeek = useMemo(() => {
    if (!historyRes?.items) return 0;
    return historyRes.items.filter(l => l.date >= weekStartStr && l.date <= weekEndStr && l.status === 'done').length;
  }, [historyRes, weekStartStr, weekEndStr]);

  return (
    <StatCell
      label="Tasks completed"
      icon={<CheckCircle2 />}
      loading={isLoading && !historyRes}
      value={completedThisWeek}
      hint="Completed this week"
    />
  );
};

// ============================================================================
// Active Focus Count Card
// ============================================================================
export const ActiveFocusCountCard = () => {
  const { data: activeTasksRes, isLoading } = useQuery({
    queryKey: queryKeys.workLogs.list({ status: ['todo', 'in_progress'] }),
    queryFn: () => workLogsApi.list({ status: ['todo', 'in_progress'] }),
    staleTime: STALE_TIME,
    placeholderData: (prev) => prev,
  });

  const count = activeTasksRes?.items.length ?? 0;

  return (
    <StatCell
      label="Active focus"
      icon={<Zap />}
      loading={isLoading && !activeTasksRes}
      value={count}
      hint="Pending or in progress"
    />
  );
};

// ============================================================================
// Streak Card
// ============================================================================
export const StreakCard = () => {
  const queryClient = useQueryClient();

  // Fetch dashboard settings from DB
  const { data: dashboardSettings } = useQuery({
    queryKey: queryKeys.settings.dashboard(),
    queryFn: () => settingsApi.getDashboardSettings(),
    staleTime: STALE_TIME,
    placeholderData: (prev) => prev,
  });

  const streakWorkdaysOnly = dashboardSettings?.streakWorkdaysOnly ?? false;

  // Mutation to persist the setting
  const { mutate: updateDashboardSettings } = useMutation({
    mutationFn: (workdaysOnly: boolean) =>
      settingsApi.updateDashboardSettings({ streakWorkdaysOnly: workdaysOnly }),
    onMutate: async (workdaysOnly) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.settings.dashboard() });
      const previous = queryClient.getQueryData(queryKeys.settings.dashboard());
      queryClient.setQueryData(queryKeys.settings.dashboard(), (old: Record<string, unknown> | undefined) => ({
        ...old,
        streakWorkdaysOnly: workdaysOnly,
      }));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.settings.dashboard(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.dashboard() });
    },
  });

  const sixtyDaysAgoStr = useMemo(() => {
    const now = new Date();
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);
    return sixtyDaysAgo.toISOString().split('T')[0];
  }, []);

  const { data: historyRes, isLoading } = useQuery({
    queryKey: queryKeys.workLogs.list({ from: sixtyDaysAgoStr }),
    queryFn: () => workLogsApi.list({ from: sixtyDaysAgoStr }),
    staleTime: STALE_TIME,
    placeholderData: (prev) => prev,
  });

  const streak = useMemo(() => {
    if (!historyRes?.items) return 0;
    
    const activityDates = new Set(historyRes.items.map(l => l.date));
    let currentStreak = 0;
    let checkDate = new Date();

    const isWeekday = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;

    if (streakWorkdaysOnly && !isWeekday(checkDate)) {
      while (!isWeekday(checkDate)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    const checkStr = checkDate.toISOString().split('T')[0];
    if (!activityDates.has(checkStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
      if (streakWorkdaysOnly) {
        while (!isWeekday(checkDate)) {
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
    }

    while (true) {
      const checkStrLoop = checkDate.toISOString().split('T')[0];
      if (activityDates.has(checkStrLoop)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
        if (streakWorkdaysOnly) {
          while (!isWeekday(checkDate)) {
            checkDate.setDate(checkDate.getDate() - 1);
          }
        }
      } else {
        break;
      }
    }

    return currentStreak;
  }, [historyRes, streakWorkdaysOnly]);

  const handleStreakModeChange = (workdaysOnly: boolean) => {
    updateDashboardSettings(workdaysOnly);
  };

  return (
    <StatCell
      label="Current streak"
      icon={<Flame className={cn(streak > 0 ? "text-warning fill-warning" : "text-muted-foreground")} />}
      extra={
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="end">
            <div className="space-y-3">
              <p className="text-sm font-medium">Streak settings</p>
              <div className="flex items-center justify-between">
                <Label htmlFor="workdays-only" className="text-xs text-muted-foreground">Workdays only (Mon-Fri)</Label>
                <Switch id="workdays-only" checked={streakWorkdaysOnly} onCheckedChange={handleStreakModeChange} />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      }
      loading={isLoading && !historyRes}
      value={`${streak} ${streak === 1 ? 'day' : 'days'}`}
      hint={streakWorkdaysOnly ? 'Consecutive workdays active' : 'Consecutive days active'}
    />
  );
};
