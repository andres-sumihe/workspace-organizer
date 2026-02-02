import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { notesApi } from '@/api/notes-vault';
import { personalProjectsApi, workLogsApi } from '@/api/journal';
import { toolsApi } from '@/api/tools';
import { queryKeys } from '@/lib/query-client';

/**
 * Prefetches dashboard data in the background on app mount.
 * This ensures that when the user navigates to Dashboard, data is already in cache.
 */
export const useDashboardPrefetch = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Compute date ranges once
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);
    const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];

    const yearStart = `${now.getFullYear()}-01-01`;
    const yearEnd = `${now.getFullYear()}-12-31`;

    // Prefetch all dashboard queries in parallel
    // Using prefetchQuery so it doesn't block render and runs in background
    void queryClient.prefetchQuery({
      queryKey: queryKeys.overtime.stats({ from: monthStartStr }),
      queryFn: () => toolsApi.getOvertimeStatistics({ from: monthStartStr }),
      staleTime: 2 * 60 * 1000,
    });

    void queryClient.prefetchQuery({
      queryKey: queryKeys.workLogs.list({ from: sixtyDaysAgoStr }),
      queryFn: () => workLogsApi.list({ from: sixtyDaysAgoStr }),
      staleTime: 2 * 60 * 1000,
    });

    void queryClient.prefetchQuery({
      queryKey: queryKeys.workLogs.list({ status: ['todo', 'in_progress'] }),
      queryFn: () => workLogsApi.list({ status: ['todo', 'in_progress'] }),
      staleTime: 2 * 60 * 1000,
    });

    void queryClient.prefetchQuery({
      queryKey: queryKeys.personalProjects.list({ status: ['active'] }),
      queryFn: () => personalProjectsApi.list({ status: ['active'] }),
      staleTime: 2 * 60 * 1000,
    });

    void queryClient.prefetchQuery({
      queryKey: queryKeys.notes.list(),
      queryFn: () => notesApi.list(),
      staleTime: 2 * 60 * 1000,
    });

    void queryClient.prefetchQuery({
      queryKey: queryKeys.workLogs.list({ from: yearStart, to: yearEnd }),
      queryFn: () => workLogsApi.list({ from: yearStart, to: yearEnd }),
      staleTime: 2 * 60 * 1000,
    });
  }, [queryClient]);
};
