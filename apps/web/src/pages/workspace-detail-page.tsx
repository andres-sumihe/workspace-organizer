import { zodResolver } from '@hookform/resolvers/zod';
import { Layers, Settings as SettingsIcon, BarChart3, ArrowLeft, FolderOpen, Loader2, Briefcase, FileSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import type { WorkspaceFormValues } from '@/features/workspaces/types';

import { AppPage, AppPageContent, AppPageTabs } from '@/components/layout/app-page';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { WorkspaceLinkedProjectsTab } from '@/features/workspaces/components/workspace-linked-projects-tab';
import { WorkspaceOverviewTab } from '@/features/workspaces/components/workspace-overview-tab';
import { WorkspaceFilesTab } from '@/features/workspaces/components/workspace-project-tab';
import { WorkspaceTemplatesTab } from '@/features/workspaces/components/workspace-templates-tab';

type TabValue = 'overview' | 'projects' | 'files' | 'templates' | 'settings';

const workspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required'),
  rootPath: z.string().min(1, 'Root path is required'),
  description: z.string().optional()
});

export const WorkspaceDetailPage = () => {
  const { workspaceId, tab = 'overview' } = useParams<{ workspaceId: string; tab?: TabValue }>();
  const navigate = useNavigate();
  const { workspaces, setActiveWorkspaceId, updateWorkspace, loading } = useWorkspaceContext();

  const [activeTab, setActiveTab] = useState<TabValue>((tab as TabValue) || 'overview');
  const [saving, setSaving] = useState(false);
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [canSelectFolder, setCanSelectFolder] = useState(false);

  const workspace = workspaces.find((w) => w.id === workspaceId);

  const editForm = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: {
      name: workspace?.name || '',
      rootPath: workspace?.rootPath || '',
      description: ''
    }
  });

  useEffect(() => {
    if (workspaceId) {
      setActiveWorkspaceId(workspaceId);
    }
  }, [workspaceId, setActiveWorkspaceId]);

  useEffect(() => {
    setCanSelectFolder(typeof window !== 'undefined' && typeof window.api?.selectDirectory === 'function');
  }, []);

  useEffect(() => {
    if (tab && ['overview', 'projects', 'files', 'templates', 'settings'].includes(tab)) {
      setActiveTab(tab as TabValue);
    }
  }, [tab]);

  useEffect(() => {
    if (workspace) {
      editForm.reset({
        name: workspace.name,
        rootPath: workspace.rootPath,
        description: ''
      });
    }
  }, [workspace, editForm]);

  const handleTabChange = (value: string) => {
    const newTab = value as TabValue;
    setActiveTab(newTab);
    navigate(`/workspaces/${workspaceId}/${newTab}`);
  };

  const handleEditSubmit = async (values: WorkspaceFormValues) => {
    if (!workspaceId) return;
    
    setSaving(true);
    try {
      await updateWorkspace(workspaceId, values);
    } catch (error) {
      console.error('Failed to update workspace:', error);
    } finally {
      setSaving(false);
    }
  };

  const pickRootFolder = async () => {
    if (!canSelectFolder) return;
    setSelectingFolder(true);
    try {
      const result = await window.api?.selectDirectory?.();
      if (!result || result.canceled || !result.path) return;
      editForm.setValue('rootPath', result.path, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true
      });
    } finally {
      setSelectingFolder(false);
    }
  };

  if (loading) {
    return (
      <AppPage
        title="Loading..."
        description="Loading workspace details..."
      >
        <AppPageContent className="flex items-center justify-center">
          <div className="text-muted-foreground">Loading workspace...</div>
        </AppPageContent>
      </AppPage>
    );
  }

  if (!workspace) {
    return (
      <AppPage
        title="Workspace Not Found"
        description="The requested workspace could not be found."
      >
        <AppPageContent className="flex items-center justify-center">
          <div className="text-muted-foreground">Workspace not found</div>
        </AppPageContent>
      </AppPage>
    );
  }

  return (
    <AppPage
      title={workspace.name}
      description={workspace.rootPath}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/workspaces')}
        >
          <ArrowLeft className="size-4 mr-2" />
          Back to Workspaces
        </Button>
      }
    >
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
        <AppPageTabs
          tabs={
            <TabsList className="h-12 bg-transparent">
              <TabsTrigger value="overview" className="gap-2">
                <BarChart3 className="size-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-2">
                <Briefcase className="size-4" />
                Projects
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-2">
                <FileSearch className="size-4" />
                File Manager
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2">
                <Layers className="size-4" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <SettingsIcon className="size-4" />
                Settings
              </TabsTrigger>
            </TabsList>
          }
        >
          <TabsContent value="overview" className="flex-1 m-0 overflow-auto p-6">
            <WorkspaceOverviewTab workspace={workspace} />
          </TabsContent>

          <TabsContent value="projects" className="flex-1 m-0 overflow-auto p-6">
            <WorkspaceLinkedProjectsTab workspaceId={workspace.id} />
          </TabsContent>

          <TabsContent value="files" className="flex-1 m-0 overflow-auto p-6">
            <WorkspaceFilesTab workspaceId={workspace.id} />
          </TabsContent>

          <TabsContent value="templates" className="flex-1 m-0 overflow-auto p-6">
            <WorkspaceTemplatesTab workspaceId={workspace.id} />
          </TabsContent>

          <TabsContent value="settings" className="flex-1 m-0 overflow-auto p-6">
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-lg font-semibold mb-4">Workspace Settings</h3>
                <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="workspace-name">Name</Label>
                    <Input id="workspace-name" {...editForm.register('name', { required: true })} placeholder="My Workspace" />
                    {editForm.formState.errors.name && (
                      <p className="text-sm text-destructive mt-1">{editForm.formState.errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="workspace-rootPath">Root Path</Label>
                    <div className="flex gap-2">
                      <Input
                        id="workspace-rootPath"
                        {...editForm.register('rootPath', { required: true })}
                        placeholder="C:\Projects\MyWorkspace"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void pickRootFolder()}
                        disabled={!canSelectFolder || selectingFolder}
                        className="shrink-0 gap-2"
                      >
                        {selectingFolder ? <Loader2 className="size-4 animate-spin" /> : <FolderOpen className="size-4" />}
                        {canSelectFolder ? 'Choose' : 'Desktop only'}
                      </Button>
                    </div>
                    {!canSelectFolder ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Folder picker currently requires the desktop shell; enter the path manually when running in the browser.
                      </p>
                    ) : null}
                    {editForm.formState.errors.rootPath && (
                      <p className="text-sm text-destructive mt-1">{editForm.formState.errors.rootPath.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="workspace-description">Description</Label>
                    <Textarea
                      id="workspace-description"
                      {...editForm.register('description')}
                      placeholder="Optional description"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </TabsContent>
        </AppPageTabs>
      </Tabs>
    </AppPage>
  );
};
