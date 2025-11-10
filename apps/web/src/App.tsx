import { FolderGit2, LayoutDashboard, LineChart, Settings, Split, Layers } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { SidebarNavItem } from '@/components/layout/app-sidebar';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AuthenticatedLayout } from '@/layouts/authenticated-layout';
import { DashboardPage } from '@/pages/dashboard-page';
import { WorkspacesPage } from '@/pages/workspaces-page';
import { FileManagerPage } from '@/pages/file-manager-page';
import { TemplatesPage } from '@/pages/templates-page';

type AppPage = 'dashboard' | 'workspaces' | 'files' | 'templates' | 'analytics' | 'system';

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
  files: {
    title: 'Files',
    description: 'Inspect and operate on workspace files directly from the desktop shell.',
  },
  templates: {
    title: 'Templates',
    description: 'Capture folder structures once and reuse them for new projects.',
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
  // Persist the active page so a browser refresh preserves the last selection.
  // Use a lazy initializer to read from localStorage when available.
  const [activePage, setActivePage] = useState<AppPage>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('wo:activePage');
        if (
          stored === 'dashboard' ||
          stored === 'workspaces' ||
          stored === 'files' ||
          stored === 'templates' ||
          stored === 'analytics' ||
          stored === 'system'
        ) {
          return stored as AppPage;
        }
      }
    } catch (_e) {
      // ignore storage errors and fall back to default
    }

    return 'dashboard';
  });

  const sidebarItems = useMemo<SidebarNavItem[]>(
    () => [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'workspaces', label: 'Workspaces', icon: FolderGit2 },
      { key: 'files', label: 'Files', icon: Split },
      { key: 'templates', label: 'Templates', icon: Layers },
      { key: 'analytics', label: 'Analytics', icon: LineChart },
      { key: 'system', label: 'System', icon: Settings },
    ],
    []
  );

  const pageContent =
    activePage === 'dashboard' ? (
      <DashboardPage />
    ) : activePage === 'workspaces' ? (
      <WorkspacesPage />
    ) : activePage === 'files' ? (
      <FileManagerPage />
    ) : activePage === 'templates' ? (
      <TemplatesPage />
    ) : (
      renderPlaceholder(activePage)
    );

  return (
    <AuthenticatedLayout
      sidebarItems={sidebarItems}
      activeSidebarKey={activePage}
      onNavigate={(key) => {
        const page = key as AppPage;
        setActivePage(page);
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('wo:activePage', page);
          }
        } catch (_e) {
          // ignore localStorage failures
        }
      }}
      connectionLabel="Connected to workspace datastore"
    >
      {pageContent}
    </AuthenticatedLayout>
  );
}
