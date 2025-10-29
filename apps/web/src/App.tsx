import { FolderGit2, LayoutDashboard, LineChart, Settings } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { SidebarNavItem } from '@/components/layout/app-sidebar';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthenticatedLayout } from '@/layouts/authenticated-layout';
import { DashboardPage } from '@/pages/dashboard-page';

type AppPage = 'dashboard' | 'workspaces' | 'analytics' | 'system';

const placeholderCopy: Record<AppPage, { title: string; description: string }> = {
  dashboard: {
    title: 'Dashboard',
    description: 'Executive overview summarising workspace health and operational metrics.',
  },
  workspaces: {
    title: 'Workspaces',
    description: 'Manage workspace inventory, indexing cadence, and template associations.',
  },
  analytics: {
    title: 'Analytics',
    description: 'Visualise adoption, usage trends, and automation coverage across workspaces.',
  },
  system: {
    title: 'System',
    description: 'Configure connectors, notifications, and integration policies.',
  },
};

const renderPlaceholder = (page: AppPage) => {
  const copy = placeholderCopy[page];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Delivery for this module is scheduled in an upcoming milestone. Track the roadmap for availability updates.
      </CardContent>
    </Card>
  );
};

export function App() {
  const [activePage, setActivePage] = useState<AppPage>('dashboard');

  const sidebarItems = useMemo<SidebarNavItem[]>(
    () => [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'workspaces', label: 'Workspaces', icon: FolderGit2 },
      { key: 'analytics', label: 'Analytics', icon: LineChart },
      { key: 'system', label: 'System', icon: Settings },
    ],
    []
  );

  const pageContent = activePage === 'dashboard' ? <DashboardPage /> : renderPlaceholder(activePage);

  return (
    <AuthenticatedLayout
      sidebarItems={sidebarItems}
      activeSidebarKey={activePage}
      onNavigate={(key) => setActivePage(key as AppPage)}
      connectionLabel="Connected to workspace datastore"
    >
      {pageContent}
    </AuthenticatedLayout>
  );
}