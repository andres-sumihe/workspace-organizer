import {
  Calendar,
  ChevronDown,
  FolderOpen,
  Pencil,
  Trash2
} from 'lucide-react';

import type { TaskUpdateFlag, WorkLogEntry, WorkLogStatus } from '@workspace/shared';

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
import { formatDateDisplay, formatTimestampDisplay } from '@/utils/journal-parser';
import { TaskFlagsSection } from './task-flags-section';
import { TaskUpdatesSection } from './task-updates-section';
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from './task-config';

export interface TaskDetailModalProps {
  /** The task/work log entry to display */
  entry: WorkLogEntry | null;
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when user clicks Edit */
  onEdit: (entry: WorkLogEntry) => void;
  /** Callback when user clicks Delete */
  onDelete: (id: string) => void;
  /** Callback when status changes */
  onStatusChange: (id: string, status: WorkLogStatus) => void;
  /** Callback when flags change */
  onFlagsChange: (id: string, flags: TaskUpdateFlag[]) => void;
}

/**
 * Reusable Task Detail Modal component.
 * Displays full task details including status, description, updates/comments, and flags.
 * Can be used in Journal page, Project Detail page, or any other page that manages tasks.
 */
export function TaskDetailModal({
  entry,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onStatusChange,
  onFlagsChange
}: TaskDetailModalProps) {
  if (!entry) return null;

  const statusConfig = TASK_STATUS_CONFIG[entry.status];
  const StatusIcon = statusConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Task Details</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            View and manage task details, status, and updates
          </DialogDescription>
        </DialogHeader>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Main Info */}
            <div className="space-y-6">
              {/* Status */}
              <div className="space-y-2">
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
                    {(Object.entries(TASK_STATUS_CONFIG) as [WorkLogStatus, typeof statusConfig][]).map(
                      ([s, c]) => (
                        <DropdownMenuItem
                          key={s}
                          onClick={() => onStatusChange(entry.id, s)}
                          className="gap-2"
                        >
                          <c.icon className={`h-4 w-4 ${c.color}`} />
                          {c.label}
                        </DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase">Description</Label>
                <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase">Date</Label>
                <p className="text-sm">{formatDateDisplay(entry.date)}</p>
              </div>

              {/* Priority */}
              {entry.priority && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase">Priority</Label>
                  <Badge variant={TASK_PRIORITY_CONFIG[entry.priority].variant}>
                    {TASK_PRIORITY_CONFIG[entry.priority].label}
                  </Badge>
                </div>
              )}

              {/* Due Date */}
              {entry.dueDate && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase">Due Date</Label>
                  <p className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDateDisplay(entry.dueDate)}
                  </p>
                </div>
              )}

              {/* Project */}
              {entry.project && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase">Project</Label>
                  <Badge variant="secondary" className="gap-1">
                    <FolderOpen className="h-3 w-3" />
                    {entry.project.title}
                  </Badge>
                </div>
              )}

              {/* Tags */}
              {entry.tags.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase">Tags</Label>
                  <div className="flex flex-wrap gap-1">
                    {entry.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined }}
                      >
                        #{tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Flags */}
              <TaskFlagsSection
                flags={entry.flags ?? []}
                onFlagsChange={(flags) => onFlagsChange(entry.id, flags)}
              />

              {/* Timestamps */}
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Created</span>
                  <span>{formatTimestampDisplay(entry.createdAt)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Updated</span>
                  <span>{formatTimestampDisplay(entry.updatedAt)}</span>
                </div>
              </div>
            </div>

            {/* Right Column - Updates/Activity */}
            <div className="space-y-4">
              <TaskUpdatesSection entityType="work_log" entityId={entry.id} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1 gap-2" onClick={() => onEdit(entry)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="destructive" size="icon" onClick={() => onDelete(entry.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
