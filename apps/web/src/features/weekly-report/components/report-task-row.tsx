import { useCallback } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Circle,
  Clock,
} from 'lucide-react';

import type {
  WeeklyReportItem,
  WeeklyReportStatus,
  WeeklyReportPriority,
  TaskUpdateFlag,
} from '@workspace/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatDateDisplay, formatTimestampDisplay } from '@/features/journal/utils/journal-parser';
import { TaskUpdatesSection } from '@/features/journal/components';

// ============================================================================
// Config
// ============================================================================

const STATUS_DISPLAY: Record<
  WeeklyReportStatus,
  { label: string; icon: typeof Circle; color: string; bgHover: string }
> = {
  todo: { label: 'To Do', icon: Circle, color: 'text-muted-foreground', bgHover: 'hover:bg-muted' },
  inProgress: { label: 'In Progress', icon: Clock, color: 'text-blue-500', bgHover: 'hover:bg-blue-500/10' },
  done: { label: 'Done', icon: Check, color: 'text-emerald-500', bgHover: 'hover:bg-emerald-500/10' },
};

const PRIORITY_BADGE: Record<
  WeeklyReportPriority,
  { label: string; variant: 'destructive' | 'warning' | 'secondary' | 'outline' }
> = {
  high: { label: 'High', variant: 'destructive' },
  medium: { label: 'Medium', variant: 'warning' },
  low: { label: 'Low', variant: 'secondary' },
  none: { label: 'None', variant: 'outline' },
};

const FLAG_CONFIG: Record<string, { label: string; color: string }> = {
  blocked: { label: 'Blocked', color: 'text-red-500 border-red-500/50' },
  needs_confirmation: { label: 'Needs Confirmation', color: 'text-amber-500 border-amber-500/50' },
  urgent: { label: 'Urgent', color: 'text-red-600 border-red-600/50' },
  on_hold: { label: 'On Hold', color: 'text-yellow-600 border-yellow-600/50' },
  waiting_feedback: { label: 'Waiting Feedback', color: 'text-blue-500 border-blue-500/50' },
};

const ALL_FLAGS: TaskUpdateFlag[] = ['blocked', 'needs_confirmation', 'urgent', 'on_hold', 'waiting_feedback'];
const ALL_STATUSES: WeeklyReportStatus[] = ['todo', 'inProgress', 'done'];
const ALL_PRIORITIES: WeeklyReportPriority[] = ['high', 'medium', 'low', 'none'];

// ============================================================================
// Props
// ============================================================================

interface ReportTaskRowProps {
  item: WeeklyReportItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStatusChange: (itemId: string, status: WeeklyReportStatus) => void;
  onPriorityChange: (itemId: string, priority: WeeklyReportPriority) => void;
  onFlagsChange: (itemId: string, flags: string[]) => void;
  isPending?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ReportTaskRow({
  item,
  isExpanded,
  onToggleExpand,
  onStatusChange,
  onPriorityChange,
  onFlagsChange,
  isPending,
}: ReportTaskRowProps) {
  const statusConfig = STATUS_DISPLAY[item.status];
  const StatusIcon = statusConfig.icon;
  const priorityConfig = PRIORITY_BADGE[item.priority];

  // -- Flag toggle helper --
  const handleFlagToggle = useCallback(
    (flag: string) => {
      const current = new Set(item.flags);
      if (current.has(flag)) {
        current.delete(flag);
      } else {
        current.add(flag);
      }
      onFlagsChange(item.id, Array.from(current));
    },
    [item.id, item.flags, onFlagsChange],
  );

  return (
    <div
      className={cn(
        'border-b border-border/50 last:border-b-0 transition-opacity',
        isPending && 'opacity-60',
      )}
    >
      {/* ── Main Row ── */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 transition-colors',
          'hover:bg-muted/50',
          isExpanded && 'bg-muted/30',
        )}
      >
        {/* Expand toggle */}
        <button type="button" onClick={onToggleExpand} className="shrink-0 p-0.5">
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform',
              isExpanded && 'rotate-90',
            )}
          />
        </button>

        {/* Status icon — clickable popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn('shrink-0 p-0.5 rounded transition-colors', statusConfig.bgHover)}
              title="Change status"
            >
              <StatusIcon className={cn('h-4 w-4', statusConfig.color)} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-36 p-1" align="start">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">Status</p>
            {ALL_STATUSES.map((s) => {
              const cfg = STATUS_DISPLAY[s];
              const Icon = cfg.icon;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onStatusChange(item.id, s)}
                  className={cn(
                    'flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm transition-colors',
                    cfg.bgHover,
                    item.status === s && 'bg-muted font-medium',
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
                  {cfg.label}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>

        {/* Task title — click to expand */}
        <button
          type="button"
          onClick={onToggleExpand}
          className={cn(
            'flex-1 text-sm text-left truncate',
            item.status === 'done' && 'line-through text-muted-foreground',
          )}
        >
          {item.title}
        </button>

        {/* Flags — inline badges */}
        {item.flags.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            {item.flags.slice(0, 2).map((flag) => {
              const fc = FLAG_CONFIG[flag];
              return (
                <Badge
                  key={flag}
                  variant="outline"
                  className={cn('text-[10px] px-1.5 py-0 h-5', fc?.color)}
                >
                  <AlertTriangle className="h-3 w-3 mr-0.5" />
                  {fc?.label ?? flag}
                </Badge>
              );
            })}
            {item.flags.length > 2 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                +{item.flags.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Priority — clickable popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="shrink-0">
              <Badge
                variant={priorityConfig.variant}
                className={cn(
                  'text-[10px] px-1.5 py-0 h-5 cursor-pointer',
                  item.priority === 'none' && 'text-muted-foreground',
                )}
              >
                {item.priority === 'none' ? '—' : priorityConfig.label}
              </Badge>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-32 p-1" align="end">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">Priority</p>
            {ALL_PRIORITIES.map((p) => {
              const cfg = PRIORITY_BADGE[p];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPriorityChange(item.id, p)}
                  className={cn(
                    'flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm transition-colors hover:bg-muted',
                    item.priority === p && 'bg-muted font-medium',
                  )}
                >
                  <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0 h-4">
                    {cfg.label}
                  </Badge>
                </button>
              );
            })}
          </PopoverContent>
        </Popover>

        {/* Status text */}
        <span className={cn('text-xs shrink-0 w-20 text-right', statusConfig.color)}>
          {statusConfig.label}
        </span>
      </div>

      {/* ── Expanded Details ── */}
      {isExpanded && (
        <div className="px-4 pl-12 pt-2 pb-4 space-y-3">
          {/* Task info row */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Created: {formatTimestampDisplay(item.createdAt)}</span>
            {item.dueDate && (
              <>
                <span>•</span>
                <span>Due: {formatDateDisplay(item.dueDate)}</span>
              </>
            )}
            {item.projectTitle && (
              <>
                <span>•</span>
                <span>Project: {item.projectTitle}</span>
              </>
            )}
          </div>

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {item.tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-5"
                  style={tag.color ? { backgroundColor: `${tag.color}20`, color: tag.color } : undefined}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Flag editor */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Flags</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_FLAGS.map((flag) => {
                const fc = FLAG_CONFIG[flag];
                const active = item.flags.includes(flag);
                return (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => handleFlagToggle(flag)}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors',
                      active
                        ? cn('bg-accent', fc?.color)
                        : 'border-border text-muted-foreground hover:bg-muted/50',
                    )}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {fc?.label ?? flag}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Task Updates — reuse shared component with full CRUD + replies */}
          <TaskUpdatesSection entityType="work_log" entityId={item.sourceId} />
        </div>
      )}
    </div>
  );
}
