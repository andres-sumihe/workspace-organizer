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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { workLogsApi } from '@/api/journal';
import { cn } from '@/lib/utils';
import type { WorkLogEntry } from '@workspace/shared';
import { useEffect, useMemo, useState } from 'react';

export const ProductivityHeatmapCard = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [historyLogs, setHistoryLogs] = useState<WorkLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const startOfYear = `${selectedYear}-01-01`;
        const endOfYear = `${selectedYear}-12-31`;
        const res = await workLogsApi.list({ from: startOfYear, to: endOfYear });
        setHistoryLogs(res.items);
      } catch (error) {
        console.error('Failed to load heatmap data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [selectedYear]);

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
};

const ProductivityHeatmap = ({ logs, year }: { logs: WorkLogEntry[]; year: number }) => {
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

  const getColor = (count: number) => {
    if (count === 0) return "bg-muted/40";
    if (count <= 2) return "bg-green-200 dark:bg-green-900/40";
    if (count <= 5) return "bg-green-400 dark:bg-green-700/60";
    return "bg-green-600 dark:bg-green-500";
  };

  // Determine starting weekday of the year (0=Sun, 6=Sat)
  const startDay = new Date(year, 0, 1).getDay();

  return (
    <div className="flex overflow-x-auto pb-2 w-full">
      <div className="grid grid-rows-7 grid-flow-col gap-1 min-w-max">
        {/* Render placeholders for days before Jan 1st to align the grid properly */}
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`placeholder-${i}`} className="w-3 h-3" />
        ))}
        
        {/* Render actual days */}
        {days.map(date => {
          // Use local timezone for date string to match database format
          const dateStr = formatDateLocal(date);
          const count = counts.get(dateStr) || 0;
          return (
            <TooltipProvider key={dateStr}>
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <div className={cn("w-3 h-3 rounded-[2px]", getColor(count))} />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs font-semibold">{date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  <p className="text-xs text-muted-foreground">{count} tasks completed</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
};
