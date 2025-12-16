import { FolderGit2, Layers, HardDrive, Activity } from 'lucide-react';

import type { WorkspaceSummary } from '@workspace/shared';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface WorkspaceOverviewTabProps {
  workspace: WorkspaceSummary;
}

export const WorkspaceOverviewTab = ({ workspace }: WorkspaceOverviewTabProps) => {
  const statusColor = {
    healthy: 'bg-success',
    degraded: 'bg-warning',
    offline: 'bg-destructive'
  }[workspace.status];

  const statusLabel = {
    healthy: 'Healthy',
    degraded: 'Degraded',
    offline: 'Offline'
  }[workspace.status];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Status Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Status</CardTitle>
          <Activity className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className={`size-2 rounded-full ${statusColor}`} />
            <span className="text-2xl font-bold">{statusLabel}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Last indexed: {new Date(workspace.lastIndexedAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>

      {/* Projects Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Projects</CardTitle>
          <FolderGit2 className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{workspace.projectCount}</div>
          <p className="text-xs text-muted-foreground">
            {workspace.projectCount === 1 ? 'Active project' : 'Active projects'}
          </p>
        </CardContent>
      </Card>

      {/* Templates Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Templates</CardTitle>
          <Layers className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{workspace.templateCount}</div>
          <p className="text-xs text-muted-foreground">
            {workspace.templateCount === 1 ? 'Assigned template' : 'Assigned templates'}
          </p>
        </CardContent>
      </Card>

      {/* Location Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Location</CardTitle>
          <HardDrive className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-sm font-mono truncate" title={workspace.rootPath}>
            {workspace.rootPath}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Workspace root path</p>
        </CardContent>
      </Card>

      {/* Info Card - Full Width */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle>Workspace Information</CardTitle>
          <CardDescription>Details about this workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Workspace ID:</span>
              <Badge variant="outline" className="font-mono">
                {workspace.id}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Created:</span>
              <span>{new Date(workspace.lastIndexedAt).toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
