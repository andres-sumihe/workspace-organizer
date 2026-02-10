import { useMemo } from 'react';

import type {
  WeeklyReportItem,
  WeeklyReportProjectGroup,
  WeeklyReportSummary,
  WeeklyReportViewMode,
} from '@workspace/shared';

import { useWorkLogsList } from '@/features/journal/hooks/use-work-logs';
import { usePersonalProjectsList } from '@/features/journal/hooks/use-personal-projects';
import {
  toReportItem,
  groupByProject,
  groupByStatus,
  groupByPriority,
  computeSummary,
} from '@/features/weekly-report/utils/weekly-report-mapper';

interface UseWeeklyReportDataParams {
  from: string;
  to: string;
  viewMode: WeeklyReportViewMode;
}

interface UseWeeklyReportDataResult {
  items: WeeklyReportItem[];
  groups: WeeklyReportProjectGroup[];
  summary: WeeklyReportSummary;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Feature-level data hook for the Weekly Report page.
 * Fetches work logs for the date range and derives report data client-side.
 *
 * Only `from` and `to` affect query keys (server-state selectors).
 * `viewMode` is a purely client-side transformation.
 */
export function useWeeklyReportData({ from, to, viewMode }: UseWeeklyReportDataParams): UseWeeklyReportDataResult {
  const { data: workLogs, isLoading: logsLoading, isError: logsError } = useWorkLogsList({ from, to });
  const { data: _projects, isLoading: projectsLoading } = usePersonalProjectsList();

  // Map WorkLogEntry[] → WeeklyReportItem[]
  const items = useMemo(() => {
    if (!workLogs?.items) return [];
    return workLogs.items.map(toReportItem);
  }, [workLogs?.items]);

  // Group items by the selected view mode
  const groups = useMemo(() => {
    switch (viewMode) {
      case 'byStatus':
        return groupByStatus(items);
      case 'byPriority':
        return groupByPriority(items);
      case 'byProject':
      default:
        return groupByProject(items);
    }
  }, [items, viewMode]);

  // Compute summary statistics
  const summary = useMemo(() => computeSummary(items), [items]);

  return {
    items,
    groups,
    summary,
    isLoading: logsLoading || projectsLoading,
    isError: logsError,
  };
}
