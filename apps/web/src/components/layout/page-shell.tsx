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
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        <div className="mt-4 w-full">
          <div className="border-t border-border" />
        </div>
      </CardHeader>

      <CardContent>
        {toolbar ? <div className="mb-4">{toolbar}</div> : null}
        <div>{children}</div>
      </CardContent>
    </Card>
  );
};

