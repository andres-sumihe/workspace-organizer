import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PageShellProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  // optional toolbar rendered under the divider and above the content
  toolbar?: ReactNode;
}

export const PageShell = ({ title, description, children, className, toolbar }: PageShellProps) => {
  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="flex flex-col items-start text-left">
        <div className="flex w-full items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {toolbar ? <div className="flex items-center gap-2 shrink-0">{toolbar}</div> : null}
        </div>
        <div className="mt-4 w-full">
          <div className="border-t border-border" />
        </div>
      </CardHeader>

      <CardContent>
        <div>{children}</div>
      </CardContent>
    </Card>
  );
};

