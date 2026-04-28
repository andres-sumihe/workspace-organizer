import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { toast } from 'sonner';

import type { WeeklyReportSummary, WeeklyReportProjectGroup } from '@workspace/shared';

import { Button } from '@/components/ui/button';
import { generateReportMarkdown, copyToClipboard } from '@/features/weekly-report/utils/weekly-report-export';

interface ReportHeaderProps {
  dateLabel: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onThisWeek: () => void;
  onLastWeek: () => void;
  onCustomPeriod: () => void;
  isThisWeek: boolean;
  isLastWeek: boolean;
  isCustomPeriod: boolean;
  summary: WeeklyReportSummary;
  groups: WeeklyReportProjectGroup[];
}

export function ReportHeader({
  dateLabel,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
  onLastWeek,
  onCustomPeriod,
  isThisWeek,
  isLastWeek,
  isCustomPeriod,
  summary,
  groups,
}: ReportHeaderProps) {
  const handleCopyMarkdown = async () => {
    const md = generateReportMarkdown(dateLabel, summary, groups);
    const ok = await copyToClipboard(md);
    if (ok) {
      toast.success('Copied to clipboard', { description: 'Weekly report markdown copied.' });
    } else {
      toast.error('Failed to copy', { description: 'Could not access clipboard.' });
    }
  };

  return (
    <div className="flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onPrevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-lg font-semibold">{dateLabel}</span>
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1 ml-2">
          <Button
            variant={isThisWeek ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={onThisWeek}
          >
            This Week
          </Button>
          <Button
            variant={isLastWeek ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={onLastWeek}
          >
            Last Week
          </Button>
          <Button
            variant={isCustomPeriod ? 'secondary' : 'outline'}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={onCustomPeriod}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Custom Period
          </Button>
        </div>
      </div>

      <Button variant="outline" size="sm" className="gap-2" onClick={handleCopyMarkdown}>
        <Copy className="h-4 w-4" />
        Copy Markdown
      </Button>
    </div>
  );
}
