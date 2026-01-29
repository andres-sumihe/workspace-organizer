import { Briefcase, FolderGit2, LayoutDashboard, LineChart, Settings, FileCode, Loader2, Users, Wrench, BookOpen, StickyNote } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom';

import type { SidebarNavItem } from '@/components/layout/app-sidebar';

import { AboutDialog } from '@/components/about-dialog';
import { LockScreen } from '@/components/lock-screen';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UpdateChecker } from '@/components/update-checker';
import { UpdateNotifier } from '@/components/update-notifier';
import { useAuth } from '@/contexts/auth-context';
import { FileManagerProvider } from '@/contexts/file-manager-context';
import { useInstallation } from '@/contexts/installation-context';
import { useMode } from '@/contexts/mode-context';
import { WorkspaceProvider } from '@/contexts/workspace-context';
import { useMenuCommands } from '@/hooks/useMenuCommands';
import { AuthenticatedLayout } from '@/layouts/authenticated-layout';
import { DashboardPage } from '@/pages/dashboard-page';
import { InstallationPage } from '@/pages/installation-page';
import { JournalPage } from '@/pages/journal-page';
import { LoginPage } from '@/pages/login-page';
import { NotePopoutPage } from '@/pages/note-popout-page';
import { NotesPage } from '@/pages/notes-page';
import { OvertimePage } from '@/pages/overtime-page';
import { ProjectDetailPage } from '@/pages/project-detail-page';
import { ProjectsPage } from '@/pages/projects-page';
import { RecoveryPage } from '@/pages/recovery-page';
import { ScriptsPage } from '@/pages/scripts-page';
import { SettingsPage } from '@/pages/settings-page';
import { SetupPage } from '@/pages/setup-page';
import { TeamPage } from '@/pages/team-page';
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

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoutes() {
  const location = useLocation();
  const { isLoading: installLoading, needsInstallation } = useInstallation();
  const { isLoading: authLoading, isAuthenticated, isLocked } = useAuth();
  const { isLoading: modeLoading, needsSetup } = useMode();

  // Show loading while checking installation/auth/setup status
  if (installLoading || authLoading || modeLoading) {
    return <LoadingScreen />;
  }

  // Redirect to installation if not configured
  if (needsInstallation) {
    return <Navigate to="/install" state={{ from: location.pathname }} replace />;
  }

  // Redirect to setup if first-time account creation is needed
  if (needsSetup) {
    return <Navigate to="/setup" state={{ from: location.pathname }} replace />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Show lock screen if session is locked due to inactivity
  if (isLocked) {
    return <LockScreen />;
  }

  // User is authenticated and app is configured - render protected content
  return (
    <WorkspaceProvider>
      <FileManagerProvider>
        <Outlet />
      </FileManagerProvider>
    </WorkspaceProvider>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isSoloMode } = useAuth();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [updateCheckerOpen, setUpdateCheckerOpen] = useState(false);
  
  // Store the last visited workspace route so we can return to it
  const lastWorkspaceRoute = useRef<string>('/workspaces');
  
  // Update last workspace route when on a workspace page
  useEffect(() => {
    if (location.pathname.startsWith('/workspaces/')) {
      lastWorkspaceRoute.current = location.pathname;
    }
  }, [location.pathname]);

  // Handle menu commands from Electron
  useMenuCommands({
    'open-workspace-root': async () => {
      try {
        if (window.api?.invokeMainAction) {
          const result = await window.api.invokeMainAction('open-workspace-root', {}) as { canceled?: boolean; path?: string };
          if (result?.path) {
            console.log('Selected workspace root:', result.path);
            navigate('/workspaces');
          }
        }
      } catch (error) {
        console.error('Failed to open workspace root:', error);
      }
    },
    'import-template': () => {
      console.log('Import template clicked');
    },
    'toggle-sidebar': () => {
      console.log('Toggle sidebar');
    },
    'toggle-devtools': () => {
      if (window.api?.toggleDevTools) {
        window.api.toggleDevTools();
      } else {
        console.log('DevTools toggle not available (running in browser)');
      }
    },
    'check-updates': () => {
      setUpdateCheckerOpen(true);
    },
    'about': () => {
      setAboutOpen(true);
    },
  });

  // Build sidebar items based on mode
  // In Solo mode, Scripts is still shown but leads to a "Team Feature" placeholder
  // Teams item only visible in Shared mode
  const sidebarItems = useMemo<SidebarNavItem[]>(
    () => [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'workspaces', label: 'Workspaces', icon: FolderGit2 },
      { key: 'projects', label: 'Projects', icon: Briefcase },
      { 
        key: 'scripts', 
        label: 'Scripts', 
        icon: FileCode,
        // Visual hint that this is a team feature
        badge: isSoloMode ? 'Team' : undefined
      },
      // Teams sidebar item only visible in Shared mode
      ...(!isSoloMode ? [{ key: 'teams', label: 'Teams', icon: Users }] : []),
      { key: 'journal', label: 'Journal', icon: BookOpen },
      { key: 'notes', label: 'Notes & Vault', icon: StickyNote },
      { 
        key: 'tools', 
        label: 'Tools', 
        icon: Wrench,
        subItems: [
          { key: 'overtime', label: 'Overtime' }
        ]
      },
      { key: 'analytics', label: 'Analytics', icon: LineChart },
      { key: 'settings', label: 'Settings', icon: Settings },
    ],
    [isSoloMode]
  );

  // Determine active key and subkey from route
  const getActiveKey = (): string => {
    const path = location.pathname;
    if (path.startsWith('/workspaces')) return 'workspaces';
    if (path.startsWith('/projects')) return 'projects';
    if (path.startsWith('/scripts')) return 'scripts';
    if (path.startsWith('/teams')) return 'teams';
    if (path.startsWith('/journal')) return 'journal';
    if (path.startsWith('/notes')) return 'notes';
    if (path.startsWith('/tools')) return 'tools';
    if (path.startsWith('/analytics')) return 'analytics';
    if (path.startsWith('/settings')) return 'settings';
    return 'dashboard';
  };

  const getActiveSubKey = (): string | undefined => {
    const path = location.pathname;
    if (path.startsWith('/tools/overtime')) return 'overtime';
    return undefined;
  };

  return (
    <>
      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <UpdateChecker open={updateCheckerOpen} onOpenChange={setUpdateCheckerOpen} />
      <AuthenticatedLayout
        sidebarItems={sidebarItems}
        activeSidebarKey={getActiveKey()}
        activeSidebarSubKey={getActiveSubKey()}
        onNavigate={(key, subKey) => {
        if (key === 'workspaces') {
          // Navigate to last visited workspace route (or list if none)
          navigate(lastWorkspaceRoute.current);
        } else if (key === 'tools' && subKey) {
          // Navigate to tools sub-page
          const toolsRoutes: Record<string, string> = {
            overtime: '/tools/overtime'
          };
          navigate(toolsRoutes[subKey] || '/tools');
        } else {
          const routes: Record<string, string> = {
            dashboard: '/',
            projects: '/projects',
            scripts: '/scripts',
            teams: '/teams',
            journal: '/journal',
            notes: '/notes',
            tools: '/tools',
            analytics: '/analytics',
            settings: '/settings'
          };
          navigate(routes[key] || '/');
        }
      }}
      connectionLabel="Connected to workspace datastore"
    >
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/workspaces" element={<WorkspacesPage />} />
        <Route path="/workspaces/:workspaceId" element={<WorkspaceDetailPage />} />
        <Route path="/workspaces/:workspaceId/:tab" element={<WorkspaceDetailPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/scripts" element={<ScriptsPage />} />
        <Route path="/scripts/:scriptId" element={<ScriptsPage />} />
        <Route path="/teams" element={<TeamPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/tools/overtime" element={<OvertimePage />} />
        <Route path="/analytics" element={renderPlaceholder('analytics')} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthenticatedLayout>
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <UpdateNotifier />
      <Routes>
        {/* Public routes - outside of auth protection */}
        <Route path="/install" element={<InstallationPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/recover" element={<RecoveryPage />} />
        {/* Protected routes - require installation and authentication */}
        <Route element={<ProtectedRoutes />}>
          <Route path="/popout/notes/:noteId" element={<NotePopoutPage />} />
          <Route path="/*" element={<AppContent />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
