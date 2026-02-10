import { ArrowLeft } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { WeeklyReportViewMode, WeeklyReportItem, WeeklyReportStatus, WeeklyReportPriority } from '@workspace/shared';

import {
  ReportHeader,
  ReportStatCards,
  ReportToolbar,
  ReportProjectGroup,
  ReportParkingLot,
} from '@/features/weekly-report/components';
import { AppPage, AppPageContent } from '@/components/layout/app-page';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useWeeklyReportData } from '@/features/weekly-report/hooks/use-weekly-report-data';
import { useUpdateWorkLog } from '@/features/journal/hooks/use-work-logs';
import {
  formatDate,
  getWeekStart,
  getWeekEnd,
  getWeekRangeLabel,
} from '@/features/journal/utils/journal-parser';
import {
  groupByProject,
  groupByStatus,
  groupByPriority,
  computeSummary,
  unmapStatus,
  unmapPriority,
} from '@/features/weekly-report/utils/weekly-report-mapper';

// ============================================================================
// Helpers
// ============================================================================

function getMondayOfCurrentWeek(): Date {
  return getWeekStart(new Date());
}

function shiftWeek(weekStart: Date, direction: -1 | 1): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 7 * direction);
  return d;
}

function isSameWeek(a: Date, b: Date): boolean {
  const sa = getWeekStart(a);
  const sb = getWeekStart(b);
  return sa.getTime() === sb.getTime();
}

/**
 * Apply client-side filter to report items.
 */
function applyFilter(items: WeeklyReportItem[], filter: string): WeeklyReportItem[] {
  switch (filter) {
    case 'active':
      return items.filter((i) => i.status !== 'done');
    case 'flagged':
      return items.filter((i) => i.flags.length > 0);
    case 'done':
      return items.filter((i) => i.status === 'done');
    default:
      return items;
  }
}

// ============================================================================
// Page Component
// ============================================================================

export function WeeklyReportPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive initial week from URL params, or default to current week
  const initialWeekStart = useMemo(() => {
    const fromParam = searchParams.get('from');
    if (fromParam) {
      const parsed = new Date(fromParam + 'T00:00:00');
      if (!isNaN(parsed.getTime())) return getWeekStart(parsed);
    }
    return getMondayOfCurrentWeek();
  }, []); // Only on mount

  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [viewMode, setViewMode] = useState<WeeklyReportViewMode>('byProject');
  const [statusFilter, setStatusFilter] = useState('all');

  // Computed date range
  const from = useMemo(() => formatDate(weekStart), [weekStart]);
  const to = useMemo(() => formatDate(getWeekEnd(weekStart)), [weekStart]);
  const dateLabel = useMemo(() => getWeekRangeLabel(weekStart), [weekStart]);
  const isThisWeek = useMemo(() => isSameWeek(weekStart, new Date()), [weekStart]);

  // Update URL when week changes
  const changeWeek = useCallback(
    (newStart: Date) => {
      setWeekStart(newStart);
      const newFrom = formatDate(newStart);
      const newTo = formatDate(getWeekEnd(newStart));
      setSearchParams({ from: newFrom, to: newTo }, { replace: true });
    },
    [setSearchParams],
  );

  const handlePrevWeek = useCallback(() => changeWeek(shiftWeek(weekStart, -1)), [weekStart, changeWeek]);
  const handleNextWeek = useCallback(() => changeWeek(shiftWeek(weekStart, 1)), [weekStart, changeWeek]);
  const handleThisWeek = useCallback(() => changeWeek(getMondayOfCurrentWeek()), [changeWeek]);
  const handleLastWeek = useCallback(
    () => changeWeek(shiftWeek(getMondayOfCurrentWeek(), -1)),
    [changeWeek],
  );

  // Data fetching — only from/to are server-state selectors
  const { items: rawItems, groups: rawGroups, summary, isLoading, isError } = useWeeklyReportData({
    from,
    to,
    viewMode,
  });

  // ── Mutations ──
  const updateWorkLog = useUpdateWorkLog();
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set());

  const markPending = useCallback((id: string, pending: boolean) => {
    setPendingItems((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleStatusChange = useCallback(
    (itemId: string, status: WeeklyReportStatus) => {
      markPending(itemId, true);
      updateWorkLog.mutate(
        { workLogId: itemId, data: { status: unmapStatus(status) } },
        { onSettled: () => markPending(itemId, false) },
      );
    },
    [updateWorkLog, markPending],
  );

  const handlePriorityChange = useCallback(
    (itemId: string, priority: WeeklyReportPriority) => {
      const mapped = unmapPriority(priority);
      if (!mapped) return;
      markPending(itemId, true);
      updateWorkLog.mutate(
        { workLogId: itemId, data: { priority: mapped } },
        { onSettled: () => markPending(itemId, false) },
      );
    },
    [updateWorkLog, markPending],
  );

  const handleFlagsChange = useCallback(
    (itemId: string, flags: string[]) => {
      markPending(itemId, true);
      updateWorkLog.mutate(
        { workLogId: itemId, data: { flags: flags as import('@workspace/shared').TaskUpdateFlag[] } },
        { onSettled: () => markPending(itemId, false) },
      );
    },
    [updateWorkLog, markPending],
  );

  // Client-side filter (does NOT change query keys)
  const filteredItems = useMemo(() => applyFilter(rawItems, statusFilter), [rawItems, statusFilter]);

  // Re-group filtered items by the selected view mode
  const { groups: filteredGroups, summary: filteredSummary } = useMemo(() => {
    let groups;
    switch (viewMode) {
      case 'byStatus':
        groups = groupByStatus(filteredItems);
        break;
      case 'byPriority':
        groups = groupByPriority(filteredItems);
        break;
      default:
        groups = groupByProject(filteredItems);
    }
    return { groups, summary: computeSummary(filteredItems) };
  }, [filteredItems, viewMode]);

  return (
    <AppPage
      title="Weekly Report"
      description="Review and summarize your weekly progress"
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/journal')}>
          <ArrowLeft className="h-4 w-4" />
          Back to Journal
        </Button>
      }
    >
      <AppPageContent className="flex flex-col gap-5 h-full overflow-auto">
        {/* Date Range Header */}
        <ReportHeader
          dateLabel={dateLabel}
          onPrevWeek={handlePrevWeek}
          onNextWeek={handleNextWeek}
          onThisWeek={handleThisWeek}
          onLastWeek={handleLastWeek}
          isThisWeek={isThisWeek}
          summary={statusFilter === 'all' ? summary : filteredSummary}
          groups={statusFilter === 'all' ? rawGroups : filteredGroups}
        />

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-18 rounded-lg" />
              ))}
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-30 rounded-lg" />
            ))}
          </div>
        )}

        {/* Error State */}
        {isError && !isLoading && (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-destructive">Failed to load work logs. Please try again.</p>
          </div>
        )}

        {/* Content */}
        {!isLoading && !isError && (
          <>
            {/* Stats Cards */}
            <ReportStatCards summary={statusFilter === 'all' ? summary : filteredSummary} />

            {/* Toolbar */}
            <ReportToolbar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
            />

            {/* Project Groups */}
            {(statusFilter === 'all' ? rawGroups : filteredGroups).length > 0 ? (
              <div className="space-y-4 pb-6">
                {(statusFilter === 'all' ? rawGroups : filteredGroups).map((group) => (
                  <ReportProjectGroup
                    key={group.projectId ?? '__unassigned'}
                    group={group}
                    showProjectLink={viewMode === 'byProject'}
                    onStatusChange={handleStatusChange}
                    onPriorityChange={handlePriorityChange}
                    onFlagsChange={handleFlagsChange}
                    pendingItems={pendingItems}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-muted-foreground">No tasks found for this week.</p>
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => navigate('/journal')}
                >
                  Go to Journal to add entries
                </Button>
              </div>
            )}

            {/* Parking Lot — quick capture during meetings */}
            <ReportParkingLot date={from} />
          </>
        )}
      </AppPageContent>
    </AppPage>
  );
}
