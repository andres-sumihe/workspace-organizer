import type { WeeklyReportProjectGroup, WeeklyReportSummary, WeeklyReportItem } from '@workspace/shared';

import { extractPlainText } from '@/components/ui/mention-content-view';

const STATUS_ICONS: Record<string, string> = {
  done: '✅',
  inProgress: '🔵',
  todo: '⬜',
};

const PRIORITY_LABELS: Record<string, string> = {
  high: '🔴 High',
  medium: '🟡 Medium',
  low: '🟢 Low',
  none: '',
};

function formatItemLine(item: WeeklyReportItem): string {
  const icon = STATUS_ICONS[item.status] ?? '⬜';
  const priority = PRIORITY_LABELS[item.priority];
  const flagStr = item.flags.length > 0 ? ` [${item.flags.join(', ')}]` : '';
  const priorityStr = priority ? ` (${priority})` : '';
  return `- ${icon} ${extractPlainText(item.title)}${priorityStr}${flagStr}`;
}

/**
 * Generate a Markdown string from the weekly report data.
 */
export function generateReportMarkdown(
  dateLabel: string,
  summary: WeeklyReportSummary,
  groups: WeeklyReportProjectGroup[],
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Weekly Report: ${dateLabel}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Total Tasks | ${summary.totalTasks} |`);
  lines.push(`| Completed | ${summary.byStatus.done} (${summary.completionRate}%) |`);
  lines.push(`| In Progress | ${summary.byStatus.inProgress} |`);
  lines.push(`| To Do | ${summary.byStatus.todo} |`);
  if (summary.flaggedCount > 0) {
    lines.push(`| Flagged | ${summary.flaggedCount} |`);
  }
  lines.push('');

  // Groups
  for (const group of groups) {
    lines.push(`## ${group.projectTitle} (${group.stats.done}/${group.stats.total} done)`);
    lines.push('');

    if (group.items.length === 0) {
      lines.push('_No tasks for this period._');
      lines.push('');
      continue;
    }

    for (const item of group.items) {
      lines.push(formatItemLine(item));
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Copy text to clipboard with fallback for older browsers.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback: hidden textarea
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
