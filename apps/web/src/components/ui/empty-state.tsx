import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export const EmptyState = ({ icon: Icon, title, description, action, compact, className }: EmptyStateProps) => (
  <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-1.5 py-6' : 'gap-2 py-12', className)}>
    {Icon ? (
      <div className="mb-1 flex size-9 items-center justify-center rounded-md border border-border bg-muted/60 text-muted-foreground">
        <Icon className="size-4" />
      </div>
    ) : null}
    <p className="text-sm font-medium">{title}</p>
    {description ? <p className="max-w-xs text-xs text-muted-foreground">{description}</p> : null}
    {action ? <div className="mt-2">{action}</div> : null}
  </div>
);
