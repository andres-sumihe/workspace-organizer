import {
  Calendar,
  Check,
  ChevronDown,
  Circle,
  Clock,
  Pencil,
  Trash2,
  Users as UsersIcon,
  X
} from 'lucide-react';

import type { TaskUpdateFlag, TeamTask, TeamTaskStatus } from '@workspace/shared';

import { MentionContentView } from '@/components/ui/mention-content-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { formatDateDisplay, formatTimestampDisplay } from '@/features/journal/utils/journal-parser';
import { TaskFlagsSection } from '@/features/journal/components/task-flags-section';
import { TeamTaskUpdatesSection } from './team-task-updates-section';

// ── Status / Priority configs (mirrors page-level configs) ──

const TASK_STATUS_CONFIG: Record<
  TeamTaskStatus,
  { label: string; icon: typeof Circle; color: string }
> = {
  pending: {
    label: 'Todo',
    icon: Circle,
    color: 'text-gray-500'
  },
  in_progress: {
    label: 'In Progress',
    icon: Clock,
    color: 'text-blue-500'
  },
  completed: {
    label: 'Completed',
    icon: Check,
    color: 'text-green-500'
  },
  cancelled: {
    label: 'Cancelled',
    icon: X,
    color: 'text-red-500'
  }
};

const TASK_PRIORITY_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  low: { label: 'Low', variant: 'secondary' },
  medium: { label: 'Medium', variant: 'outline' },
  high: { label: 'High', variant: 'destructive' },
  urgent: { label: 'Urgent', variant: 'destructive' }
};

export interface TeamTaskDetailModalProps {
  task: TeamTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (task: TeamTask) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TeamTaskStatus) => void;
  onFlagsChange: (id: string, flags: TaskUpdateFlag[]) => void;
  teamId: string;
  projectId: string;
}

export function TeamTaskDetailModal({
  task,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onStatusChange,
  onFlagsChange,
  teamId,
  projectId
}: TeamTaskDetailModalProps) {
  if (!task) return null;

  const statusConfig = TASK_STATUS_CONFIG[task.status];
  const StatusIcon = statusConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold truncate">{task.title}</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            View and manage team task details, status, and updates
          </DialogDescription>
        </DialogHeader>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* ── Top Section: Task Info ── */}
          <div className="space-y-5">
            {/* Description */}
            <div className="flex items-start gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase">Description</Label>
                <MentionContentView content={task.description || task.title} className="whitespace-pre-wrap" />
              </div>
            </div>

            <hr />

            {/* Status + Priority row */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase">Status</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
                      {statusConfig.label}
                      <ChevronDown className="h-4 w-4 ml-auto" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {(
                      Object.entries(TASK_STATUS_CONFIG) as [TeamTaskStatus, typeof statusConfig][]
                    ).map(([s, c]) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => onStatusChange(task.id, s)}
                        className="gap-2"
                      >
                        <c.icon className={`h-4 w-4 ${c.color}`} />
                        {c.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase">Priority</Label>
                <div className="h-9 flex items-center">
                  <Badge variant={TASK_PRIORITY_CONFIG[task.priority]?.variant ?? 'outline'}>
                    {TASK_PRIORITY_CONFIG[task.priority]?.label ?? task.priority}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {/* Due Date */}
              {task.dueDate && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase">Due Date</Label>
                  <p className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDateDisplay(task.dueDate)}
                  </p>
                </div>
              )}

              {/* Assignees */}
              {task.assignees.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground uppercase">Assignees</Label>
                  <div className="flex flex-wrap gap-1">
                    {task.assignees.map((a) => (
                      <Badge key={a.email} variant="secondary" className="gap-1">
                        <UsersIcon className="h-3 w-3" />
                        {a.displayName || a.email.split('@')[0]}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Flags */}
            <TaskFlagsSection
              flags={task.flags ?? []}
              onFlagsChange={(flags) => onFlagsChange(task.id, flags)}
            />

            {/* Timestamps */}
            <div className="flex gap-6 text-xs text-muted-foreground pt-2 border-t">
              <span>Created: {formatTimestampDisplay(task.createdAt)}</span>
              <span>Updated: {formatTimestampDisplay(task.updatedAt)}</span>
            </div>
          </div>

          {/* ── Bottom Section: Updates/Activity ── */}
          <div className="border-t pt-4">
            <TeamTaskUpdatesSection
              teamId={teamId}
              projectId={projectId}
              taskId={task.id}
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1 gap-2" onClick={() => onEdit(task)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="destructive" size="icon" onClick={() => onDelete(task.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
