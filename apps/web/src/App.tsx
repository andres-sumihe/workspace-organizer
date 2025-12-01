import { FolderGit2, LayoutDashboard, LineChart, Settings, FileCode } from 'lucide-react';
import { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

import type { SidebarNavItem } from '@/components/layout/app-sidebar';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileManagerProvider } from '@/contexts/file-manager-context';
import { WorkspaceProvider } from '@/contexts/workspace-context';
import { AuthenticatedLayout } from '@/layouts/authenticated-layout';
import { DashboardPage } from '@/pages/dashboard-page';
import { ScriptsPage } from '@/pages/scripts-page';
import { SettingsPage } from '@/pages/settings-page';
import { WorkspaceDetailPage } from '@/pages/workspace-detail-page';
import { WorkspacesPage } from '@/pages/workspaces-page';

type AppPage = 'dashboard' | 'workspaces' | 'files' | 'scripts' | 'templates' | 'analytics' | 'settings' | 'system';

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
  scripts: {
    title: 'Batch Scripts',
    description: 'Track and manage batch scripts with drive mapping conflict detection.',
  },
  templates: {
    title: 'Templates',
    description: 'Capture folder structures once and reuse them for new projects.',
  },
  settings: {
    title: 'Settings',
    description: 'Configure application settings and validation criteria.',
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

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const sidebarItems = useMemo<SidebarNavItem[]>(
    () => [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'workspaces', label: 'Workspaces', icon: FolderGit2 },
      { key: 'scripts', label: 'Scripts', icon: FileCode },
      { key: 'analytics', label: 'Analytics', icon: LineChart },
      { key: 'settings', label: 'Settings', icon: Settings },
    ],
    []
  );

  // Determine active key from route
  const getActiveKey = () => {
    const path = location.pathname;
    if (path.startsWith('/workspaces')) return 'workspaces';
    if (path.startsWith('/scripts')) return 'scripts';
    if (path.startsWith('/analytics')) return 'analytics';
    if (path.startsWith('/settings')) return 'settings';
    return 'dashboard';
  };

  return (
    <AuthenticatedLayout
      sidebarItems={sidebarItems}
      activeSidebarKey={getActiveKey()}
      onNavigate={(key) => {
        const routes: Record<string, string> = {
          dashboard: '/',
          workspaces: '/workspaces',
          scripts: '/scripts',
          analytics: '/analytics',
          settings: '/settings'
        };
        navigate(routes[key] || '/');
      }}
      connectionLabel="Connected to workspace datastore"
    >
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/workspaces" element={<WorkspacesPage />} />
        <Route path="/workspaces/:workspaceId" element={<WorkspaceDetailPage />} />
        <Route path="/workspaces/:workspaceId/:tab" element={<WorkspaceDetailPage />} />
        <Route path="/scripts" element={<ScriptsPage />} />
        <Route path="/analytics" element={renderPlaceholder('analytics')} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthenticatedLayout>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <FileManagerProvider>
          <AppContent />
        </FileManagerProvider>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}
