import type { ReactNode } from 'react';

import { AppSidebar, type SidebarNavItem } from '@/components/layout/app-sidebar';
import { TopNav } from '@/components/layout/top-nav';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

interface AuthenticatedLayoutProps {
  children: ReactNode;
  sidebarItems: SidebarNavItem[];
  activeSidebarKey: string;
  onNavigate: (key: string) => void;
  connectionLabel?: string;
}

export const AuthenticatedLayout = ({
  children,
  sidebarItems,
  activeSidebarKey,
  onNavigate,
  connectionLabel,
}: AuthenticatedLayoutProps) => {
  return (
    <SidebarProvider className="bg-background">
      <AppSidebar
        items={sidebarItems}
        activeKey={activeSidebarKey}
        onNavigate={onNavigate}
        connectionLabel={connectionLabel}
      />
      <SidebarInset
        className={cn(
          '@container/content flex min-h-svh flex-1 flex-col bg-background',
          'has-data-[layout=fixed]:h-svh',
          'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]',
          // Only apply the inset padding when the sidebar variant is `inset`.
          // For the normal (fixed) sidebar variant the component already renders a
          // spacer element to create the layout gap, so applying padding here
          // causes a double-offset. Using the peer-data variant limits the
          // padding to inset layouts where it's needed.
          'md:peer-data-[variant=inset]:pl-[var(--sidebar-inset)]'
        )}
      >
        <TopNav />
        <main className="relative flex-1 overflow-y-auto px-6 py-6">
          {/* Make the main area fill the available width so page content/cards
              stretch to the area's width. Remove the max-width constraint so
              the PageShell card (w-full) fills the content area as expected. */}
          <div className="flex w-full flex-col gap-6">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
