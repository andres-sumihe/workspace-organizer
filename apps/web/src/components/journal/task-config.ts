import { Check, Circle, Clock, X } from 'lucide-react';

import type { WorkLogStatus, WorkLogPriority } from '@workspace/shared';

/**
 * Status configuration for task/work log entries.
 * Used consistently across Journal and Project Detail pages.
 */
export const TASK_STATUS_CONFIG: Record<
  WorkLogStatus,
  { label: string; icon: typeof Circle; color: string; bgColor: string; accent?: string }
> = {
  todo: {
    label: 'To Do',
    icon: Circle,
    color: 'text-muted-foreground',
    bgColor: 'bg-[#F4F5F7] dark:bg-[#1D2125]',
    accent: 'before:bg-zinc-400 dark:before:bg-zinc-600'
  },
  in_progress: {
    label: 'In Progress',
    icon: Clock,
    color: 'text-[#0052CC] dark:text-[#4C9AFF]',
    bgColor: 'bg-[#F4F5F7] dark:bg-[#1D2125]',
    accent: 'before:bg-[#0052CC] dark:before:bg-[#4C9AFF]'
  },
  done: {
    label: 'Done',
    icon: Check,
    color: 'text-[#36B37E] dark:text-[#E3FCEF]',
    bgColor: 'bg-[#F4F5F7] dark:bg-[#1D2125]',
    accent: 'before:bg-[#36B37E]'
  },
  blocked: {
    label: 'Blocked',
    icon: X,
    color: 'text-[#FF5630]',
    bgColor: 'bg-[#F4F5F7] dark:bg-[#1D2125]',
    accent: 'before:bg-[#FF5630]'
  }
};

/**
 * Priority configuration for task/work log entries.
 */
export const TASK_PRIORITY_CONFIG: Record<WorkLogPriority, { label: string; variant: "destructive" | "warning" | "secondary" }> = {
  low: { label: 'Low', variant: 'secondary' },
  medium: { label: 'Medium', variant: 'warning' },
  high: { label: 'High', variant: 'destructive' }
};
