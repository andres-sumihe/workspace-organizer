import { CheckCircle2, Circle, Clock, AlertTriangle, ListTodo } from 'lucide-react';

import type { WeeklyReportSummary } from '@workspace/shared';

import { Card, CardContent } from '@/components/ui/card';

interface ReportStatCardsProps {
  summary: WeeklyReportSummary;
}

export function ReportStatCards({ summary }: ReportStatCardsProps) {
  const stats = [
    {
      label: 'Total Tasks',
      value: summary.totalTasks,
      icon: ListTodo,
      iconColor: 'text-muted-foreground',
    },
    {
      label: 'Done',
      value: summary.byStatus.done,
      subtitle: `${summary.completionRate}%`,
      icon: CheckCircle2,
      iconColor: 'text-emerald-500',
    },
    {
      label: 'In Progress',
      value: summary.byStatus.inProgress,
      icon: Clock,
      iconColor: 'text-blue-500',
    },
    {
      label: 'To Do',
      value: summary.byStatus.todo,
      icon: Circle,
      iconColor: 'text-muted-foreground',
    },
    ...(summary.flaggedCount > 0
      ? [
          {
            label: 'Flagged',
            value: summary.flaggedCount,
            icon: AlertTriangle,
            iconColor: 'text-amber-500',
          },
        ]
      : []),
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
      {stats.map((s) => (
        <Card key={s.label} className="py-3">
          <CardContent className="px-4 py-0">
            <div className="flex items-center gap-3">
              <s.icon className={`h-5 w-5 shrink-0 ${s.iconColor}`} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{s.label}</p>
                <p className="text-xl font-bold leading-tight">
                  {s.value}
                  {s.subtitle && (
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      {s.subtitle}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
