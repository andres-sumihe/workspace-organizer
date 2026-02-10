import type {
  WeeklyReportItem,
  WeeklyReportProjectGroup,
  WeeklyReportSummary,
  WeeklyReportStatus,
  WeeklyReportPriority,
  WorkLogEntry,
  WorkLogStatus,
  WorkLogPriority,
} from '@workspace/shared';

/**
 * Map WorkLogStatus → WeeklyReportStatus
 */
export function mapStatus(status: string): WeeklyReportStatus {
  switch (status) {
    case 'in_progress':
      return 'inProgress';
    case 'done':
      return 'done';
    default:
      return 'todo';
  }
}

/**
 * Reverse map WeeklyReportStatus → WorkLogStatus (for mutations)
 */
export function unmapStatus(status: WeeklyReportStatus): WorkLogStatus {
  switch (status) {
    case 'inProgress':
      return 'in_progress';
    case 'done':
      return 'done';
    default:
      return 'todo';
  }
}

/**
 * Map WorkLogPriority → WeeklyReportPriority
 */
export function mapPriority(priority?: string): WeeklyReportPriority {
  switch (priority) {
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'none';
  }
}

/**
 * Reverse map WeeklyReportPriority → WorkLogPriority | undefined (for mutations)
 */
export function unmapPriority(priority: WeeklyReportPriority): WorkLogPriority | undefined {
  switch (priority) {
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return undefined;
  }
}

/**
 * Transform a WorkLogEntry into a WeeklyReportItem.
 * Updates are left empty — they're lazy-loaded on expand (Phase 2).
 */
export function toReportItem(entry: WorkLogEntry): WeeklyReportItem {
  return {
    id: entry.id,
    sourceId: entry.id,
    projectId: entry.projectId ?? null,
    projectTitle: entry.project?.title ?? null,
    title: entry.content,
    status: mapStatus(entry.status),
    priority: mapPriority(entry.priority),
    flags: entry.flags ?? [],
    tags: entry.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    dueDate: entry.dueDate ?? null,
    date: entry.date,
    createdAt: entry.createdAt,
    updates: [], // Lazy-loaded on expand
  };
}

/**
 * Group report items by project.
 */
export function groupByProject(items: WeeklyReportItem[]): WeeklyReportProjectGroup[] {
  const map = new Map<string | null, WeeklyReportItem[]>();

  for (const item of items) {
    const key = item.projectId;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(item);
  }

  const groups: WeeklyReportProjectGroup[] = [];

  for (const [projectId, groupItems] of map) {
    const done = groupItems.filter((i) => i.status === 'done').length;
    const inProgress = groupItems.filter((i) => i.status === 'inProgress').length;
    const todo = groupItems.filter((i) => i.status === 'todo').length;
    const total = groupItems.length;

    groups.push({
      projectId,
      projectTitle: groupItems[0]?.projectTitle ?? 'Unassigned',
      items: groupItems,
      stats: {
        total,
        done,
        inProgress,
        todo,
        completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
      },
    });
  }

  // Sort: named projects first (alphabetically), then unassigned
  groups.sort((a, b) => {
    if (a.projectId === null) return 1;
    if (b.projectId === null) return -1;
    return a.projectTitle.localeCompare(b.projectTitle);
  });

  return groups;
}

/**
 * Group report items by status.
 */
export function groupByStatus(items: WeeklyReportItem[]): WeeklyReportProjectGroup[] {
  const statusOrder: WeeklyReportStatus[] = ['inProgress', 'todo', 'done'];
  const statusLabels: Record<WeeklyReportStatus, string> = {
    todo: 'To Do',
    inProgress: 'In Progress',
    done: 'Done',
  };

  return statusOrder
    .map((status) => {
      const groupItems = items.filter((i) => i.status === status);
      const done = groupItems.filter((i) => i.status === 'done').length;
      return {
        projectId: status,
        projectTitle: statusLabels[status],
        items: groupItems,
        stats: {
          total: groupItems.length,
          done,
          inProgress: groupItems.filter((i) => i.status === 'inProgress').length,
          todo: groupItems.filter((i) => i.status === 'todo').length,
          completionRate: groupItems.length > 0 ? Math.round((done / groupItems.length) * 100) : 0,
        },
      };
    })
    .filter((g) => g.items.length > 0);
}

/**
 * Group report items by priority.
 */
export function groupByPriority(items: WeeklyReportItem[]): WeeklyReportProjectGroup[] {
  const priorityOrder: WeeklyReportPriority[] = ['high', 'medium', 'low', 'none'];
  const priorityLabels: Record<WeeklyReportPriority, string> = {
    high: 'High Priority',
    medium: 'Medium Priority',
    low: 'Low Priority',
    none: 'No Priority',
  };

  return priorityOrder
    .map((priority) => {
      const groupItems = items.filter((i) => i.priority === priority);
      const done = groupItems.filter((i) => i.status === 'done').length;
      return {
        projectId: priority,
        projectTitle: priorityLabels[priority],
        items: groupItems,
        stats: {
          total: groupItems.length,
          done,
          inProgress: groupItems.filter((i) => i.status === 'inProgress').length,
          todo: groupItems.filter((i) => i.status === 'todo').length,
          completionRate: groupItems.length > 0 ? Math.round((done / groupItems.length) * 100) : 0,
        },
      };
    })
    .filter((g) => g.items.length > 0);
}

/**
 * Compute summary statistics from report items.
 */
export function computeSummary(items: WeeklyReportItem[]): WeeklyReportSummary {
  const byStatus: Record<WeeklyReportStatus, number> = { todo: 0, inProgress: 0, done: 0 };
  const byPriority: Record<WeeklyReportPriority, number> = { high: 0, medium: 0, low: 0, none: 0 };
  let flaggedCount = 0;

  for (const item of items) {
    byStatus[item.status]++;
    byPriority[item.priority]++;
    if (item.flags.length > 0) flaggedCount++;
  }

  const total = items.length;
  return {
    totalTasks: total,
    byStatus,
    byPriority,
    completionRate: total > 0 ? Math.round((byStatus.done / total) * 100) : 0,
    flaggedCount,
  };
}
