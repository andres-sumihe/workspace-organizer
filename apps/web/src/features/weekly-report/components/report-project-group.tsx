import { useState } from 'react';
import { ChevronDown, ExternalLink, Folder } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import type { WeeklyReportPriority, WeeklyReportProjectGroup, WeeklyReportStatus } from '@workspace/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ReportTaskRow } from './report-task-row';

interface ReportProjectGroupProps {
  group: WeeklyReportProjectGroup;
  /** When view mode is not "byProject", hide the project link */
  showProjectLink?: boolean;
  onStatusChange?: (itemId: string, status: WeeklyReportStatus) => void;
  onPriorityChange?: (itemId: string, priority: WeeklyReportPriority) => void;
  onFlagsChange?: (itemId: string, flags: string[]) => void;
  onMarkReported?: (itemId: string, reportedAt: string | null) => void;
  /** Map of itemId → true when that item is mid-mutation */
  pendingItems?: Set<string>;
}

export function ReportProjectGroup({
  group,
  showProjectLink = true,
  onStatusChange,
  onPriorityChange,
  onFlagsChange,
  onMarkReported,
  pendingItems,
}: ReportProjectGroupProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const hasItems = group.items.length > 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="px-4 py-3 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                  collapsed && '-rotate-90',
                )}
              />
              <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-semibold text-sm truncate">{group.projectTitle}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                ({group.stats.total} {group.stats.total === 1 ? 'task' : 'tasks'})
              </span>
            </button>

            {showProjectLink && group.projectId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => navigate(`/projects/${group.projectId}`)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-muted-foreground">
              {group.stats.done}/{group.stats.total} done
            </span>
            <div className="w-24">
              <Progress value={group.stats.completionRate} className="h-1.5" />
            </div>
            <span className="text-xs font-medium w-8 text-right">
              {group.stats.completionRate}%
            </span>
          </div>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="p-0">
          {hasItems ? (
            <div className="border-t border-border/50">
              {group.items.map((item) => (
                <ReportTaskRow
                  key={item.id}
                  item={item}
                  isExpanded={expandedItems.has(item.id)}
                  onToggleExpand={() => toggleItem(item.id)}
                  onStatusChange={onStatusChange ?? (() => {})}
                  onPriorityChange={onPriorityChange ?? (() => {})}
                  onFlagsChange={onFlagsChange ?? (() => {})}
                  onMarkReported={onMarkReported}
                  isPending={pendingItems?.has(item.id)}
                />
              ))}
            </div>
          ) : (
            <div className="border-t border-border/50 px-4 py-6 text-center">
              <p className="text-sm text-muted-foreground">No tasks for this period.</p>
              {showProjectLink && group.projectId && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 text-xs"
                  onClick={() => navigate(`/projects/${group.projectId}`)}
                >
                  Plan Tasks →
                </Button>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
