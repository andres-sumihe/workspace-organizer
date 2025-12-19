import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface AppPageProps {
  /** Page title displayed in the header */
  title: string;
  /** Optional description under the title */
  description?: string;
  /** Action buttons on the right side of the header */
  actions?: ReactNode;
  /** Main content area - typically tabs or scrollable content */
  children: ReactNode;
  /** Additional className for the container */
  className?: string;
}

/**
 * AppPage provides a consistent full-page layout for main application screens.
 * 
 * Structure:
 * - Fixed header with title, description, and actions
 * - Flexible content area that fills remaining space
 * 
 * Use this for pages with tabs or complex layouts that need full viewport control.
 * For simpler card-based layouts, use PageShell instead.
 */
export const AppPage = ({ title, description, actions, children, className }: AppPageProps) => {
  return (
    <div className={cn('absolute inset-0 flex flex-col bg-background', className)}>
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2">{actions}</div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {children}
      </div>
    </div>
  );
};

interface AppPageTabsProps {
  /** Tab triggers - the TabsList component */
  tabs: ReactNode;
  /** Tab content panels */
  children: ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * AppPageTabs provides consistent styling for tab navigation within AppPage.
 * Wraps Tabs component with proper spacing and background.
 */
export const AppPageTabs = ({ tabs, children, className }: AppPageTabsProps) => {
  return (
    <div className={cn('flex-1 flex flex-col min-h-0', className)}>
      <div className="border-b border-border bg-muted px-6 shrink-0">
        {tabs}
      </div>
      <div className="flex-1 overflow-auto min-h-0">
        {children}
      </div>
    </div>
  );
};

interface AppPageContentProps {
  /** Content to render */
  children: ReactNode;
  /** Additional className */
  className?: string;
  /** Enable padding (default: true) */
  padded?: boolean;
  /** Enable scroll (default: true) */
  scrollable?: boolean;
}

/**
 * AppPageContent provides consistent content area styling within AppPage.
 */
export const AppPageContent = ({ children, className, padded = true, scrollable = true }: AppPageContentProps) => {
  return (
    <div className={cn(
      'flex-1',
      scrollable && 'overflow-auto',
      padded && 'p-6',
      className
    )}>
      {children}
    </div>
  );
};
