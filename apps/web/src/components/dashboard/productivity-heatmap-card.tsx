import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { workLogsApi } from '@/api/journal';
import { cn } from '@/lib/utils';
import type { WorkLogEntry } from '@workspace/shared';
import { memo, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';

export const ProductivityHeatmapCard = memo(function ProductivityHeatmapCard() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Use query for fetching logs
  const { data: logsRes, isLoading } = useQuery({
    queryKey: queryKeys.workLogs.list({ from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` }),
    queryFn: () => workLogsApi.list({ from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` }),
    placeholderData: (prev) => prev,
  });

  const historyLogs = useMemo(() => logsRes?.items ?? [], [logsRes]);

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base">Productivity Heatmap</CardTitle>
          <CardDescription>Activity in {selectedYear}</CardDescription>
        </div>
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-[100px] h-8">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map(year => (
              <SelectItem key={year} value={String(year)}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[140px] flex items-center justify-center text-muted-foreground text-sm">
            Loading...
          </div>
        ) : (
          <ProductivityHeatmap logs={historyLogs} year={selectedYear} />
        )}
      </CardContent>
    </Card>
  );
});

const ProductivityHeatmap = memo(function ProductivityHeatmap({ logs, year }: { logs: WorkLogEntry[]; year: number }) {
  // Helper to format date as YYYY-MM-DD in local timezone
  const formatDateLocal = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Generate all days of the selected year
  const days = useMemo(() => {
    const d = [];
    const date = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    while (date <= end) {
      d.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return d;
  }, [year]);

  // Map counts - only count completed tasks using actualEndDate
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    logs
      .filter(l => l.status === 'done' && l.actualEndDate)
      .forEach(l => {
        // actualEndDate is stored as YYYY-MM-DD, use directly
        const dateStr = l.actualEndDate!.split('T')[0];
        map.set(dateStr, (map.get(dateStr) || 0) + 1);
      });
    return map;
  }, [logs]);

  // Improved color scheme with better visibility in both themes
  const getColor = (count: number) => {
    if (count === 0) return "bg-neutral-200 dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600";
    if (count <= 2) return "bg-green-300 dark:bg-green-800 border-green-400 dark:border-green-700";
    if (count <= 5) return "bg-green-500 dark:bg-green-600 border-green-600 dark:border-green-500";
    return "bg-green-700 dark:bg-green-400 border-green-800 dark:border-green-300";
  };

  // Determine starting weekday of the year (0=Sun, 6=Sat)
  const startDay = new Date(year, 0, 1).getDay();
  
  // Calculate number of weeks (columns)
  const totalDays = startDay + days.length;
  const numWeeks = Math.ceil(totalDays / 7);
  
  // Calculate cell size: (100% - gaps) / numWeeks
  // Gap is 2px between cells, so total gap width = (numWeeks - 1) * 2px
  // Cell size = (containerWidth - totalGaps) / numWeeks
  const gapPx = 2;
  const cellSize = `calc((100% - ${(numWeeks - 1) * gapPx}px) / ${numWeeks})`;

  return (
    <div className="w-full">
      {/* Responsive grid with consistent cell sizes */}
      <div 
        className="grid grid-rows-7 grid-flow-col"
        style={{ 
          gridTemplateColumns: `repeat(${numWeeks}, ${cellSize})`,
          gap: `${gapPx}px`,
        }}
      >
        {/* Render placeholders for days before Jan 1st to align the grid properly */}
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`placeholder-${i}`} style={{ paddingBottom: '100%' }} />
        ))}
        
        {/* Render actual days - use native title for performance */}
        {days.map(date => {
          const dateStr = formatDateLocal(date);
          const count = counts.get(dateStr) || 0;
          const titleText = `${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}: ${count} tasks completed`;
          return (
            <div 
              key={dateStr}
              title={titleText}
              className={cn(
                "rounded-[2px] border cursor-default",
                getColor(count)
              )} 
              style={{ paddingBottom: '100%' }}
            />
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-3 text-xs text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-[2px]">
          <div className="w-3 h-3 rounded-[2px] border bg-neutral-200 dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600" />
          <div className="w-3 h-3 rounded-[2px] border bg-green-300 dark:bg-green-800 border-green-400 dark:border-green-700" />
          <div className="w-3 h-3 rounded-[2px] border bg-green-500 dark:bg-green-600 border-green-600 dark:border-green-500" />
          <div className="w-3 h-3 rounded-[2px] border bg-green-700 dark:bg-green-400 border-green-800 dark:border-green-300" />
        </div>
        <span>More</span>
      </div>
    </div>
  );
});
