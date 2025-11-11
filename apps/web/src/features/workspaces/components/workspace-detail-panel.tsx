import { FilePlus, FolderOpen, FolderPlus, Loader2, Pencil } from 'lucide-react';

import { formatDate } from '../utils';

import type { TemplateSummary } from '@/types/desktop';
import type { WorkspaceDetail, WorkspaceProject, WorkspaceSummary } from '@workspace/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface WorkspaceDetailPanelProps {
  detailLoading: boolean;
  selectedWorkspace: WorkspaceSummary | null;
  workspaceDetail: WorkspaceDetail | null;
  desktopAvailable: boolean;
  workspaceTemplates: TemplateSummary[];
  workspaceTemplateError: string | null;
  onManageTemplates: () => void;
  projects: WorkspaceProject[];
  projectLoading: boolean;
  projectError: string | null;
  templateApplyMessage: string | null;
  onOpenProjectDialog: () => void;
  onEditWorkspace: () => void;
  onOpenProjectInExplorer: (project: WorkspaceProject) => void;
  onTriggerFsDialog: (mode: 'folder' | 'file', project: WorkspaceProject) => void;
}

export const WorkspaceDetailPanel = ({
  detailLoading,
  selectedWorkspace,
  workspaceDetail,
  desktopAvailable,
  workspaceTemplates,
  workspaceTemplateError,
  onManageTemplates,
  projects,
  projectLoading,
  projectError,
  templateApplyMessage,
  onOpenProjectDialog,
  onEditWorkspace,
  onOpenProjectInExplorer,
  onTriggerFsDialog
}: WorkspaceDetailPanelProps) => {
  if (detailLoading) {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading workspace detail...
        </div>
      </div>
    );
  }

  if (!selectedWorkspace || !workspaceDetail) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Select a workspace to view its details.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-foreground">{workspaceDetail.name}</p>
          <p className="text-xs text-muted-foreground break-all">{workspaceDetail.rootPath}</p>
        </div>
        <Button size="sm" variant="ghost" className="flex items-center gap-2" onClick={onEditWorkspace}>
          <Pencil className="size-4" /> Edit
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{workspaceDetail.description || 'No description provided.'}</p>
      <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
        <div>
          Last indexed
          <p className="text-sm text-foreground">{formatDate(workspaceDetail.lastIndexedAt)}</p>
        </div>
        <div>
          Created
          <p className="text-sm text-foreground">{formatDate(workspaceDetail.statistics.lastScanAt)}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Workspace templates</p>
            <p className="text-xs text-muted-foreground">Templates offered when creating projects.</p>
          </div>
          {desktopAvailable ? (
            <Button size="sm" variant="outline" onClick={onManageTemplates}>
              Manage
            </Button>
          ) : null}
        </div>
        {workspaceTemplateError ? <p className="text-xs text-destructive">{workspaceTemplateError}</p> : null}
        {workspaceTemplates.length ? (
          <div className="flex flex-wrap gap-2">
            {workspaceTemplates.map((tpl) => (
              <Badge key={tpl.id} variant="outline">
                {tpl.name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {desktopAvailable
              ? 'No templates assigned. Manage templates to curate the list shown when creating projects.'
              : 'Templates available when running the desktop shell.'}
          </p>
        )}
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Projects</p>
          <p className="text-xs text-muted-foreground">Track folders that belong to this workspace.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onOpenProjectDialog}>
          Add project
        </Button>
      </div>
      {projectError ? <p className="text-xs text-destructive">{projectError}</p> : null}
      {templateApplyMessage ? <p className="text-xs text-emerald-600">{templateApplyMessage}</p> : null}
      {projectLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects registered yet.</p>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div key={project.id} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{project.name}</p>
                  <p className="text-xs text-muted-foreground break-all">{project.relativePath}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => onOpenProjectInExplorer(project)} className="flex items-center gap-1">
                  <FolderOpen className="size-4" /> Open
                </Button>
              </div>
              {project.description ? <p className="mt-2 text-xs text-muted-foreground">{project.description}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!desktopAvailable}
                  onClick={() => onTriggerFsDialog('folder', project)}
                  className="flex items-center gap-1"
                >
                  <FolderPlus className="size-4" /> New folder
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!desktopAvailable}
                  onClick={() => onTriggerFsDialog('file', project)}
                  className="flex items-center gap-1"
                >
                  <FilePlus className="size-4" /> New file
                </Button>
              </div>
              {!desktopAvailable ? (
                <p className="mt-2 text-[11px] text-muted-foreground">Desktop shell required for file operations.</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
