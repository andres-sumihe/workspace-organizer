import type { WorkLogEntry } from '@workspace/shared';

import { extractPlainText } from '@/components/ui/mention-content-view';
import { workLogsApi } from '@/features/journal/api/journal';
import { getTodayDate } from '@/features/journal/utils/journal-parser';

const toDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function previousWorkday(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return toDateString(d);
}

const formatLine = (entry: WorkLogEntry) => {
  const text = extractPlainText(entry.content).split('\n')[0]?.trim() || '(untitled)';
  const project = entry.project?.title ? `[${entry.project.title}] ` : '';
  const state = entry.status === 'in_progress' ? ' (in progress)' : '';
  return `- ${project}${text}${state}`;
};

const humanDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export async function buildStandupText(): Promise<string> {
  const today = getTodayDate();
  const since = previousWorkday();
  const [doneRes, openRes] = await Promise.all([
    workLogsApi.list({ from: since, to: today, status: ['done'] }),
    workLogsApi.list({ from: '2000-01-01', to: today, status: ['todo', 'in_progress'] }),
  ]);
  const open = [...openRes.items].sort((a, b) => (a.status === b.status ? 0 : a.status === 'in_progress' ? -1 : 1));
  const section = (title: string, items: WorkLogEntry[]) =>
    [title, ...(items.length ? items.map(formatLine) : ['- none'])].join('\n');

  return [
    `Standup ${humanDate(today)}`,
    '',
    section(`Done since ${humanDate(since)}`, doneRes.items),
    '',
    section('Today', open),
    '',
    'Blockers',
    '- none',
  ].join('\n');
}
