import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Circle,
  Clock,
  Loader2,
  MessageSquarePlus,
  Send,
  X,
} from 'lucide-react';

import type {
  WeeklyReportItem,
  WeeklyReportStatus,
  WeeklyReportPriority,
  TaskUpdateFlag,
  CreateTaskUpdateRequest,
} from '@workspace/shared';

import { taskUpdatesApi } from '@/api/journal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

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
// Helper: relative time
// ============================================================================

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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

  // -- Quick update form state --
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateContent, setUpdateContent] = useState('');

  const queryClient = useQueryClient();
  const updateQueryKey = ['task-updates', 'work_log', item.sourceId];

  // -- Lazy-load task updates when expanded --
  const { data: updatesRes, isLoading: updatesLoading } = useQuery({
    queryKey: updateQueryKey,
    queryFn: () => taskUpdatesApi.listByEntity('work_log', item.sourceId),
    enabled: isExpanded, // Only fetch when row is expanded
    staleTime: 30_000,   // Cache for 30s to avoid refetch on collapse/expand
  });

  const updates = [...(updatesRes?.items ?? [])].reverse(); // Newest first

  // -- Create task update mutation --
  const createUpdateMutation = useMutation({
    mutationFn: (data: CreateTaskUpdateRequest) => taskUpdatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: updateQueryKey });
      setUpdateContent('');
      setShowUpdateForm(false);
    },
  });

  const handleAddUpdate = useCallback(() => {
    if (!updateContent.trim()) return;
    createUpdateMutation.mutate({
      entityType: 'work_log',
      entityId: item.sourceId,
      content: updateContent.trim(),
    });
  }, [createUpdateMutation, item.sourceId, updateContent]);

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
        <div className="px-4 pl-12 pb-4 space-y-3">
          {/* Task info row */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Entry: {item.date}</span>
            {item.dueDate && (
              <>
                <span>•</span>
                <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
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

          {/* Task Updates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                Updates {updates.length > 0 && `(${updates.length})`}
              </p>
              {!showUpdateForm && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => setShowUpdateForm(true)}
                >
                  <MessageSquarePlus className="h-3 w-3" />
                  Add Note
                </Button>
              )}
            </div>

            {/* Quick update form */}
            {showUpdateForm && (
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a quick note or update..."
                  value={updateContent}
                  onChange={(e) => setUpdateContent(e.target.value)}
                  className="min-h-16 text-sm resize-none"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleAddUpdate();
                    }
                  }}
                />
                <div className="flex items-center gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setShowUpdateForm(false);
                      setUpdateContent('');
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={!updateContent.trim() || createUpdateMutation.isPending}
                    onClick={handleAddUpdate}
                  >
                    {createUpdateMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3 mr-1" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            )}

            {/* Updates list */}
            {updatesLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading updates...
              </div>
            )}

            {!updatesLoading && updates.length === 0 && !showUpdateForm && (
              <p className="text-xs text-muted-foreground italic py-1">No updates yet.</p>
            )}

            {updates.map((update) => (
              <div key={update.id} className="flex gap-2 py-1.5 group">
                <div className="w-1 shrink-0 rounded-full bg-border" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm whitespace-pre-wrap wrap-break-word">{update.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatRelativeTime(update.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
