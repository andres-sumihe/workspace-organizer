import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';

import { workLogsApi } from '@/features/journal/api/journal';
import { getTodayDate, getYesterdayDate } from '@/features/journal/utils/journal-parser';
import { settingsApi } from '@/features/settings/api/settings';
import { queryKeys } from '@/lib/query-client';

const LAST_RUN_KEY = 'wo.autoRolloverDate';

export function useAutoRollover() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: queryKeys.settings.dashboard(),
    queryFn: () => settingsApi.getDashboardSettings(),
    staleTime: 5 * 60 * 1000,
  });
  const mode = settings?.autoRolloverMode ?? 'off';

  useEffect(() => {
    if (mode === 'off') return;
    const today = getTodayDate();
    let lastRun: string | null = null;
    try {
      lastRun = localStorage.getItem(LAST_RUN_KEY);
    } catch {
      lastRun = null;
    }
    if (lastRun === today) return;

    let cancelled = false;
    void (async () => {
      try {
        const result = await workLogsApi.list({
          from: '2000-01-01',
          to: getYesterdayDate(),
          status: ['todo', 'in_progress'],
        });
        const dates = [...new Set(result.items.map((entry) => entry.date))];
        for (const fromDate of dates) {
          await workLogsApi.rollover({ fromDate, toDate: today, mode });
        }
        try {
          localStorage.setItem(LAST_RUN_KEY, today);
        } catch {
          // per-device convenience only
        }
        if (cancelled || result.items.length === 0) return;
        queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.personalProjects.lists() });
        const count = result.items.length;
        toast.success(`${mode === 'move' ? 'Moved' : 'Copied'} ${count} unfinished task${count === 1 ? '' : 's'} to today`);
      } catch (err) {
        console.error('Auto rollover failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, queryClient]);
}
