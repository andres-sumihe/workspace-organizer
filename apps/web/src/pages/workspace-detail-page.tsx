import { zodResolver } from '@hookform/resolvers/zod';
import { Layers, FolderTree, Settings as SettingsIcon, BarChart3, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import type { WorkspaceFormValues } from '@/features/workspaces/types';

import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { WorkspaceOverviewTab } from '@/features/workspaces/components/workspace-overview-tab';
import { WorkspaceFilesTab } from '@/features/workspaces/components/workspace-project-tab';
import { WorkspaceTemplatesTab } from '@/features/workspaces/components/workspace-templates-tab';

type TabValue = 'overview' | 'projects' | 'templates' | 'settings';

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
    if (tab && ['overview', 'projects', 'templates', 'settings'].includes(tab)) {
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

  if (loading) {
    return (
      <PageShell
        title="Loading..."
        description="Loading workspace details..."
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading workspace...</div>
        </div>
      </PageShell>
    );
  }

  if (!workspace) {
    return (
      <PageShell
        title="Workspace Not Found"
        description="The requested workspace could not be found."
      >
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Workspace not found</div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={workspace.name}
      description={workspace.rootPath}
      toolbar={
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/workspaces')}
        >
          <ArrowLeft className="size-4" />
          Back to Workspaces
        </Button>
      }
    >
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="size-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-2">
            <FolderTree className="size-4" />
            Projects
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

        <TabsContent value="overview" className="space-y-4">
          <WorkspaceOverviewTab workspace={workspace} />
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <WorkspaceFilesTab workspaceId={workspace.id} />
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <WorkspaceTemplatesTab workspaceId={workspace.id} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Workspace Settings</h3>
              <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4 max-w-2xl">
                <div>
                  <Label htmlFor="workspace-name">Name</Label>
                  <Input id="workspace-name" {...editForm.register('name', { required: true })} placeholder="My Workspace" />
                  {editForm.formState.errors.name && (
                    <p className="text-sm text-destructive mt-1">{editForm.formState.errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="workspace-rootPath">Root Path</Label>
                  <Input
                    id="workspace-rootPath"
                    {...editForm.register('rootPath', { required: true })}
                    placeholder="C:\Projects\MyWorkspace"
                  />
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
      </Tabs>
    </PageShell>
  );
};
