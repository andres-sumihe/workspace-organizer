import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  DollarSign,
  Flame,
  Settings2,
  Zap
} from 'lucide-react';

import { workLogsApi } from '@/api/journal';
import { toolsApi } from '@/api/tools';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/query-client';

const STREAK_WORKDAYS_KEY = 'dashboard_streak_workdays_only';
const STALE_TIME = 2 * 60 * 1000; // 2 minutes

// ============================================================================
// Monthly Overtime Card
// ============================================================================
export const OvertimeStatCard = () => {
  const monthStartStr = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  }, []);

  const { data: overtimeStats, isLoading } = useQuery({
    queryKey: queryKeys.tools.overtimeStats({ from: monthStartStr }),
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Monthly Overtime</CardTitle>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading && !overtimeStats ? (
          <>
            <Skeleton className="h-8 w-[80px] mb-2" />
            <Skeleton className="h-3 w-[120px]" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{formatCurrency(overtimeStats?.totalPay ?? 0)}</div>
            <p className="text-xs text-muted-foreground">
              {overtimeStats?.totalHours ?? 0} hours recorded this month
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Tasks Completed This Week Card
// ============================================================================
export const TasksCompletedCard = () => {
  const { weekStartStr, sixtyDaysAgoStr } = useMemo(() => {
    const now = new Date();
    const dist = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dist);
    
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);
    
    return {
      weekStartStr: weekStart.toISOString().split('T')[0],
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
    return historyRes.items.filter(l => l.date >= weekStartStr && l.status === 'done').length;
  }, [historyRes, weekStartStr]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading && !historyRes ? (
          <>
            <Skeleton className="h-8 w-[40px] mb-2" />
            <Skeleton className="h-3 w-[100px]" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{completedThisWeek}</div>
            <p className="text-xs text-muted-foreground">Completed this week</p>
          </>
        )}
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Active Focus</CardTitle>
        <Zap className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading && !activeTasksRes ? (
          <>
            <Skeleton className="h-8 w-[40px] mb-2" />
            <Skeleton className="h-3 w-[140px]" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{count}</div>
            <p className="text-xs text-muted-foreground">Tasks pending or in-progress</p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Streak Card
// ============================================================================
export const StreakCard = () => {
  const [streakWorkdaysOnly, setStreakWorkdaysOnly] = useState(() => {
    return localStorage.getItem(STREAK_WORKDAYS_KEY) === 'true';
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
    setStreakWorkdaysOnly(workdaysOnly);
    localStorage.setItem(STREAK_WORKDAYS_KEY, String(workdaysOnly));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-3">
                <p className="text-sm font-medium">Streak Settings</p>
                <div className="flex items-center justify-between">
                  <Label htmlFor="workdays-only" className="text-xs text-muted-foreground">Workdays only (Mon-Fri)</Label>
                  <Switch 
                    id="workdays-only" 
                    checked={streakWorkdaysOnly} 
                    onCheckedChange={handleStreakModeChange}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Flame className={cn("h-4 w-4", streak > 0 ? "text-orange-500 fill-orange-500" : "text-muted-foreground")} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && !historyRes ? (
          <>
            <Skeleton className="h-8 w-[60px] mb-2" />
            <Skeleton className="h-3 w-[140px]" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{streak} Days</div>
            <p className="text-xs text-muted-foreground">
              {streakWorkdaysOnly ? 'Consecutive workdays active' : 'Consecutive days active'}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};
