import { ArrowLeft, CheckCircle2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useWeeklyReportData } from '@/features/weekly-report/hooks/use-weekly-report-data';
import { useUpdateWorkLog, useBulkMarkReported } from '@/features/journal/hooks/use-work-logs';
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

function getRangeLabel(start: Date, end: Date): string {
  const msPerDay = 1000 * 60 * 60 * 24;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const days = Math.round((endDay - startDay) / msPerDay) + 1;
  if (days <= 7) return getWeekRangeLabel(start);
  const weeks = Math.ceil(days / 7);
  return `${formatDate(start)} – ${formatDate(end)} (${weeks} wks)`;
}

function isCurrentWeek(start: Date, end: Date): boolean {
  const mon = getMondayOfCurrentWeek();
  const sun = getWeekEnd(mon);
  return start.getTime() === mon.getTime() && end.getTime() === sun.getTime();
}

function isLastWeekRange(start: Date, end: Date): boolean {
  const lastMon = shiftWeek(getMondayOfCurrentWeek(), -1);
  const lastSun = getWeekEnd(lastMon);
  return start.getTime() === lastMon.getTime() && end.getTime() === lastSun.getTime();
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

  // Derive initial range from URL params, or default to current week
  const { initialRangeStart, initialRangeEnd, initialCustomOpen } = useMemo(() => {
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const mon = getMondayOfCurrentWeek();

    let start = mon;
    let end = getWeekEnd(mon);

    if (fromParam) {
      const parsed = new Date(fromParam + 'T00:00:00');
      if (!isNaN(parsed.getTime())) start = parsed;
    }
    if (toParam) {
      const parsed = new Date(toParam + 'T00:00:00');
      if (!isNaN(parsed.getTime())) end = parsed;
    }

    // Auto-open custom panel if URL encodes a non-standard range (> 7 days)
    const msPerDay = 1000 * 60 * 60 * 24;
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    const initialCustomOpen = Math.round((endDay - startDay) / msPerDay) + 1 > 7;

    return { initialRangeStart: start, initialRangeEnd: end, initialCustomOpen };
  }, []); // Only on mount

  const [rangeStart, setRangeStart] = useState(initialRangeStart);
  const [rangeEnd, setRangeEnd] = useState(initialRangeEnd);
  const [viewMode, setViewMode] = useState<WeeklyReportViewMode>('byProject');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showUnreportedOnly, setShowUnreportedOnly] = useState(false);
  const [showCustomPeriod, setShowCustomPeriod] = useState(initialCustomOpen);

  // Computed date range
  const from = useMemo(() => formatDate(rangeStart), [rangeStart]);
  const to = useMemo(() => formatDate(rangeEnd), [rangeEnd]);
  const dateLabel = useMemo(() => getRangeLabel(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  // Preset active states — mutually exclusive with showCustomPeriod
  const isThisWeek = useMemo(() => !showCustomPeriod && isCurrentWeek(rangeStart, rangeEnd), [showCustomPeriod, rangeStart, rangeEnd]);
  const isLastWeek = useMemo(() => !showCustomPeriod && isLastWeekRange(rangeStart, rangeEnd), [showCustomPeriod, rangeStart, rangeEnd]);

  // Update URL when range changes
  const changeRange = useCallback(
    (newStart: Date, newEnd: Date) => {
      setRangeStart(newStart);
      setRangeEnd(newEnd);
      setSearchParams({ from: formatDate(newStart), to: formatDate(newEnd) }, { replace: true });
    },
    [setSearchParams],
  );

  const handlePrevWeek = useCallback(() => {
    const spanDays = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
    const newStart = new Date(rangeStart);
    newStart.setDate(newStart.getDate() - 7);
    const newEnd = new Date(newStart);
    newEnd.setDate(newEnd.getDate() + spanDays);
    changeRange(newStart, newEnd);
  }, [rangeStart, rangeEnd, changeRange]);

  const handleNextWeek = useCallback(() => {
    const spanDays = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
    const newStart = new Date(rangeStart);
    newStart.setDate(newStart.getDate() + 7);
    const newEnd = new Date(newStart);
    newEnd.setDate(newEnd.getDate() + spanDays);
    changeRange(newStart, newEnd);
  }, [rangeStart, rangeEnd, changeRange]);

  const handleThisWeek = useCallback(() => {
    const mon = getMondayOfCurrentWeek();
    changeRange(mon, getWeekEnd(mon));
    setShowCustomPeriod(false);
  }, [changeRange]);

  const handleLastWeek = useCallback(() => {
    const lastMon = shiftWeek(getMondayOfCurrentWeek(), -1);
    changeRange(lastMon, getWeekEnd(lastMon));
    setShowCustomPeriod(false);
  }, [changeRange]);

  const handleCustomPeriod = useCallback(() => {
    setShowCustomPeriod((v: boolean) => !v);
  }, []);

  const handleRangeStartChange = useCallback(
    (dateStr: string) => {
      const parsed = new Date(dateStr + 'T00:00:00');
      if (!isNaN(parsed.getTime())) changeRange(parsed, rangeEnd);
    },
    [rangeEnd, changeRange],
  );

  const handleRangeEndChange = useCallback(
    (dateStr: string) => {
      const parsed = new Date(dateStr + 'T00:00:00');
      if (!isNaN(parsed.getTime())) changeRange(rangeStart, parsed);
    },
    [rangeStart, changeRange],
  );

  // Data fetching — only from/to are server-state selectors
  const { items: rawItems, isLoading, isError } = useWeeklyReportData({
    from,
    to,
    viewMode,
  });

  // ── Mutations ──
  const updateWorkLog = useUpdateWorkLog();
  const bulkMarkReported = useBulkMarkReported();
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

  const handleMarkReported = useCallback(
    (itemId: string, reportedAt: string | null) => {
      markPending(itemId, true);
      bulkMarkReported.mutate(
        { ids: [itemId], reportedAt },
        { onSettled: () => markPending(itemId, false) },
      );
    },
    [bulkMarkReported, markPending],
  );

  // Client-side filter (does NOT change query keys)
  const filteredItems = useMemo(() => {
    let items = applyFilter(rawItems, statusFilter);
    if (showUnreportedOnly) {
      items = items.filter((i) => !i.reportedAt);
    }
    return items;
  }, [rawItems, statusFilter, showUnreportedOnly]);

  const handleMarkAllReported = useCallback(() => {
    const ids = filteredItems.filter((i) => !i.reportedAt).map((i) => i.id);
    if (ids.length === 0) return;
    bulkMarkReported.mutate({ ids, reportedAt: new Date().toISOString() });
  }, [filteredItems, bulkMarkReported]);

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
          onCustomPeriod={handleCustomPeriod}
          isThisWeek={isThisWeek}
          isLastWeek={isLastWeek}
          isCustomPeriod={showCustomPeriod}
          summary={filteredSummary}
          groups={filteredGroups}
        />

        {/* Custom Date Range Inputs — animated collapsible */}
        <div
          className={`grid transition-all duration-300 ease-in-out ${
            showCustomPeriod ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="flex items-center gap-3 flex-wrap pb-1">
              <span className="text-sm text-muted-foreground shrink-0">Period:</span>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => handleRangeStartChange(e.target.value)}
                  className="h-8 w-[148px] text-sm"
                />
                <span className="text-muted-foreground text-sm">to</span>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => handleRangeEndChange(e.target.value)}
                  className="h-8 w-[148px] text-sm"
                />
              </div>
              {(() => {
                const msPerDay = 1000 * 60 * 60 * 24;
                const startDay = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime();
                const endDay = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()).getTime();
                const days = Math.round((endDay - startDay) / msPerDay) + 1;
                if (days > 7) {
                  const weeks = Math.ceil(days / 7);
                  return (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {weeks} weeks
                    </Badge>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>

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
            <ReportStatCards summary={filteredSummary} />

            {/* Toolbar */}
            <ReportToolbar
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
            />

            {/* Reporting bar */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant={showUnreportedOnly ? 'default' : 'outline'}
                size="sm"
                className="gap-2 h-8 text-xs"
                onClick={() => setShowUnreportedOnly((v) => !v)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Unreported only
                {showUnreportedOnly && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                    {filteredItems.length}
                  </Badge>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-2 h-8 text-xs"
                disabled={bulkMarkReported.isPending || filteredItems.filter((i) => !i.reportedAt).length === 0}
                onClick={handleMarkAllReported}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Mark all as reported
                {filteredItems.filter((i) => !i.reportedAt).length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                    {filteredItems.filter((i) => !i.reportedAt).length}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Project Groups */}
            {filteredGroups.length > 0 ? (
              <div className="space-y-4 pb-6">
                {filteredGroups.map((group) => (
                  <ReportProjectGroup
                    key={group.projectId ?? '__unassigned'}
                    group={group}
                    showProjectLink={viewMode === 'byProject'}
                    onStatusChange={handleStatusChange}
                    onPriorityChange={handlePriorityChange}
                    onFlagsChange={handleFlagsChange}
                    onMarkReported={handleMarkReported}
                    pendingItems={pendingItems}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-muted-foreground">
                  {showUnreportedOnly ? 'All tasks in this period have been reported.' : 'No tasks found for this period.'}
                </p>
                {!showUnreportedOnly && (
                  <Button
                    variant="link"
                    className="mt-2"
                    onClick={() => navigate('/journal')}
                  >
                    Go to Journal to add entries
                  </Button>
                )}
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
