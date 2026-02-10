import { LayoutGrid, ListFilter } from 'lucide-react';

import type { WeeklyReportViewMode } from '@workspace/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ReportToolbarProps {
  viewMode: WeeklyReportViewMode;
  onViewModeChange: (mode: WeeklyReportViewMode) => void;
  statusFilter: string;
  onStatusFilterChange: (filter: string) => void;
}

const VIEW_OPTIONS: { value: WeeklyReportViewMode; label: string }[] = [
  { value: 'byProject', label: 'By Project' },
  { value: 'byStatus', label: 'By Status' },
  { value: 'byPriority', label: 'By Priority' },
];

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Tasks' },
  { value: 'active', label: 'Active Only' },
  { value: 'flagged', label: 'Flagged Only' },
  { value: 'done', label: 'Done Only' },
];

export function ReportToolbar({
  viewMode,
  onViewModeChange,
  statusFilter,
  onStatusFilterChange,
}: ReportToolbarProps) {
  return (
    <div className="flex items-center gap-3 shrink-0">
      <div className="flex items-center gap-2">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        <Select value={viewMode} onValueChange={(v) => onViewModeChange(v as WeeklyReportViewMode)}>
          <SelectTrigger className="w-35 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIEW_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <ListFilter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-32.5 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
