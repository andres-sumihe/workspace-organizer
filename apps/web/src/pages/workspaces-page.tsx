import {
  FilePlus,
  FolderOpen,
  FolderPlus,
  Loader2,
  Pencil,
  RefreshCw
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { WorkspaceDetail, WorkspaceProject, WorkspaceSummary } from '@workspace/shared';

import {
  fetchWorkspaceList,
  createWorkspace,
  fetchWorkspaceDetail,
  updateWorkspace as updateWorkspaceApi,
  fetchWorkspaceProjects,
  createWorkspaceProject
} from '@/api/workspaces';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose
} from '@/components/ui/dialog';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

interface WorkspaceFormValues {
  name: string;
  rootPath: string;
  description?: string;
}

interface ProjectFormValues {
  name: string;
  relativePath: string;
  description?: string;
}

interface FolderFormValues {
  folderName: string;
}

interface FileFormValues {
  fileName: string;
  content: string;
}

const sanitizeRelativeSegment = (value: string) => value.replace(/\\/g, '/').replace(/^\/+/, '').trim();

const combineRelativePaths = (base: string, child: string) => {
  const normalizedBase = sanitizeRelativeSegment(base);
  const normalizedChild = sanitizeRelativeSegment(child);
  if (!normalizedBase) return normalizedChild;
  if (!normalizedChild) return normalizedBase;
  return `${normalizedBase}/${normalizedChild}`;
};

const buildAbsolutePath = (rootPath: string, relativePath: string) => {
  if (!relativePath) {
    return rootPath;
  }
  const separator = rootPath.includes('\\') ? '\\' : '/';
  const trimmedRoot = rootPath.replace(/[\\/]+$/, '');
  const normalizedRelative = relativePath
    .replace(/^[\\/]+/, '')
    .replace(/[\\/]+/g, separator);
  return `${trimmedRoot}${separator}${normalizedRelative}`;
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

export const WorkspacesPage = () => {
  const [items, setItems] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(6);
  const [total, setTotal] = useState<number | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [canSelectFolder, setCanSelectFolder] = useState(false);

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [workspaceDetail, setWorkspaceDetail] = useState<WorkspaceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [templateApplyMessage, setTemplateApplyMessage] = useState<string | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [desktopAvailable, setDesktopAvailable] = useState(false);
  const [fsDialog, setFsDialog] = useState<{ mode: 'folder' | 'file'; project: WorkspaceProject } | null>(null);
  const [fsError, setFsError] = useState<string | null>(null);
  const [fsSuccess, setFsSuccess] = useState<string | null>(null);
  const [allTemplates, setAllTemplates] = useState<TemplateSummary[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [workspaceTemplates, setWorkspaceTemplates] = useState<TemplateSummary[]>([]);
  const [workspaceTemplateIds, setWorkspaceTemplateIds] = useState<string[]>([]);
  const [workspaceTemplateDialogOpen, setWorkspaceTemplateDialogOpen] = useState(false);
  const [workspaceTemplateSaving, setWorkspaceTemplateSaving] = useState(false);
  const [workspaceTemplateDraft, setWorkspaceTemplateDraft] = useState<string[]>([]);
  const [workspaceTemplateError, setWorkspaceTemplateError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const workspaceForm = useForm<WorkspaceFormValues>({
    defaultValues: { name: '', rootPath: '', description: '' }
  });

  const editWorkspaceForm = useForm<WorkspaceFormValues>({
    defaultValues: { name: '', rootPath: '', description: '' }
  });

  const projectForm = useForm<ProjectFormValues>({
    defaultValues: { name: '', relativePath: '', description: '' }
  });

  const [projectPathEdited, setProjectPathEdited] = useState(false);

  const folderForm = useForm<FolderFormValues>({ defaultValues: { folderName: '' } });
  const fileForm = useForm<FileFormValues>({ defaultValues: { fileName: '', content: '' } });

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const payload = await fetchWorkspaceList(page, pageSize, signal);
        setItems(payload.items);
        setTotal(payload.meta.total);

        if (!selectedWorkspaceId && payload.items.length > 0) {
          setSelectedWorkspaceId(payload.items[0].id);
        }
      } catch (err: unknown) {
        if (signal?.aborted) return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, selectedWorkspaceId]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.api?.selectDirectory === 'function') {
      setCanSelectFolder(true);
    }
    if (typeof window !== 'undefined' && typeof window.api?.createDirectory === 'function') {
      setDesktopAvailable(true);
    }
  }, []);

  useEffect(() => {
    if (projectDialogOpen) {
      projectForm.reset({ name: '', relativePath: '', description: '' });
      setProjectPathEdited(false);
      setSelectedTemplateId('');
      setTemplateApplyMessage(null);
    }
  }, [projectDialogOpen, projectForm]);

  const loadAllTemplates = useCallback(async () => {
    if (!desktopAvailable || !window.api?.listTemplates) {
      setAllTemplates([]);
      return;
    }
    setTemplateLoading(true);
    setTemplateError(null);
    try {
      const response = await window.api.listTemplates();
      if (!response.ok || !response.templates) {
        throw new Error(response.error || 'Unable to load templates');
      }
      setAllTemplates(response.templates);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load templates';
      setTemplateError(message);
    } finally {
      setTemplateLoading(false);
    }
  }, [desktopAvailable]);

  useEffect(() => {
    if (desktopAvailable) {
      void loadAllTemplates();
    }
  }, [desktopAvailable, loadAllTemplates]);

  const refreshWorkspaceTemplates = useCallback(
    async (workspace: WorkspaceDetail | null) => {
      if (!workspace?.rootPath || !desktopAvailable || !window.api?.listWorkspaceTemplates) {
        setWorkspaceTemplates([]);
        setWorkspaceTemplateIds([]);
        return;
      }
      try {
        const resp = await window.api.listWorkspaceTemplates({ workspaceRoot: workspace.rootPath });
        if (!resp.ok || !resp.templates) {
          setWorkspaceTemplates([]);
          setWorkspaceTemplateIds([]);
          return;
        }
        const templateIds = resp.templateIds ?? resp.templates.map((tpl) => tpl.id);
        setWorkspaceTemplates(resp.templates);
        setWorkspaceTemplateIds(templateIds);

        const templateCount = templateIds.length;
        setWorkspaceDetail((prev) =>
          prev && prev.id === workspace.id ? { ...prev, templateCount, status: templateCount > 0 ? 'healthy' : prev.status } : prev
        );
        setItems((prev) =>
          prev.map((ws) =>
            ws.id === workspace.id ? { ...ws, templateCount, status: templateCount > 0 ? 'healthy' : ws.status } : ws
          )
        );
      } catch (err) {
        console.error('Failed to load workspace templates', err);
        setWorkspaceTemplates([]);
        setWorkspaceTemplateIds([]);
      }
    },
    [desktopAvailable]
  );

  const loadDetailAndProjects = useCallback(
    async (workspaceId: string) => {
      setDetailLoading(true);
      setProjectLoading(true);
      setDetailError(null);
      setProjectError(null);
      try {
        const [detailResp, projectsResp] = await Promise.all([
          fetchWorkspaceDetail(workspaceId),
          fetchWorkspaceProjects(workspaceId)
        ]);
        setWorkspaceDetail(detailResp.workspace);
        editWorkspaceForm.reset({
          name: detailResp.workspace.name,
          rootPath: detailResp.workspace.rootPath,
          description: detailResp.workspace.description ?? ''
        });
        setProjects(projectsResp.projects);
        await refreshWorkspaceTemplates(detailResp.workspace);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load workspace detail';
        setDetailError(message);
        setProjectError(message);
        setProjects([]);
      } finally {
        setDetailLoading(false);
        setProjectLoading(false);
      }
    },
    [editWorkspaceForm, refreshWorkspaceTemplates]
  );

  useEffect(() => {
    if (!selectedWorkspaceId) {
      setWorkspaceDetail(null);
      setProjects([]);
      return;
    }
    void loadDetailAndProjects(selectedWorkspaceId);
  }, [selectedWorkspaceId, loadDetailAndProjects]);

  useEffect(() => {
    if (desktopAvailable && workspaceDetail) {
      void refreshWorkspaceTemplates(workspaceDetail);
    }
  }, [desktopAvailable, workspaceDetail, refreshWorkspaceTemplates]);

  const projectNameValue = projectForm.watch('name');
  const availableTemplates = useMemo(
    () => (workspaceTemplates.length > 0 ? workspaceTemplates : allTemplates),
    [workspaceTemplates, allTemplates]
  );

  const getWorkspaceTemplateCount = useCallback(
    (workspaceId: string, fallback: number) =>
      workspaceDetail && workspaceDetail.id === workspaceId && workspaceTemplateIds.length > 0
        ? workspaceTemplateIds.length
        : fallback,
    [workspaceDetail, workspaceTemplateIds.length]
  );

  const getWorkspaceStatus = useCallback(
    (workspaceId: string, fallback: WorkspaceSummary['status']) =>
      workspaceDetail && workspaceDetail.id === workspaceId && workspaceTemplateIds.length > 0 ? 'healthy' : fallback,
    [workspaceDetail, workspaceTemplateIds.length]
  );

  useEffect(() => {
    if (!projectDialogOpen) {
      setProjectPathEdited(false);
      return;
    }

    if (projectPathEdited) {
      return;
    }

    const suggestion = slugifyPath(projectNameValue || '');
    projectForm.setValue('relativePath', suggestion, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false
    });
  }, [projectNameValue, projectForm, projectPathEdited, projectDialogOpen]);

  useEffect(() => {
    if (selectedTemplateId && !availableTemplates.some((tpl) => tpl.id === selectedTemplateId)) {
      setSelectedTemplateId('');
    }
  }, [availableTemplates, selectedTemplateId]);

  const handleCreateWorkspace = async (values: WorkspaceFormValues) => {
    const payload = {
      name: values.name?.trim() ?? '',
      rootPath: values.rootPath?.trim() ?? '',
      description: values.description?.trim() || undefined
    };

    if (!payload.name) {
      workspaceForm.setError('name', { type: 'manual', message: 'Name is required' });
      return;
    }

    if (!payload.rootPath) {
      workspaceForm.setError('rootPath', { type: 'manual', message: 'Root path is required' });
      return;
    }

    setCreating(true);
    try {
      const resp = await createWorkspace(payload);
      const created = (resp as unknown as { workspace?: WorkspaceSummary }).workspace;
      if (created) {
        setItems((prev) => [created, ...prev]);
        setTotal((t) => (t ?? 0) + 1);
        setSelectedWorkspaceId(created.id);
        workspaceForm.reset();
        setOpenNew(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create workspace';
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateWorkspace = async (values: WorkspaceFormValues) => {
    if (!workspaceDetail) return;
    try {
      const resp = await updateWorkspaceApi(workspaceDetail.id, {
        name: values.name?.trim(),
        rootPath: values.rootPath?.trim(),
        description: values.description?.trim()
      });
      const updated = (resp as unknown as { workspace?: WorkspaceDetail }).workspace;
      if (updated) {
        setWorkspaceDetail(updated);
        setItems((prev) =>
          prev.map((item) => (item.id === updated.id ? { ...item, name: updated.name, rootPath: updated.rootPath } : item))
        );
        setEditDialogOpen(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update workspace';
      setDetailError(message);
    }
  };

  const handleCreateProject = async (values: ProjectFormValues) => {
    if (!workspaceDetail) return;
    const payload = {
      name: values.name?.trim() ?? '',
      relativePath: values.relativePath?.trim() ?? '',
      description: values.description?.trim() || undefined
    };
    if (!payload.name) {
      projectForm.setError('name', { type: 'manual', message: 'Name is required' });
      return;
    }
    if (!payload.relativePath) {
      projectForm.setError('relativePath', { type: 'manual', message: 'Folder path is required' });
      return;
    }

    try {
      const resp = await createWorkspaceProject(workspaceDetail.id, payload);
      const created = resp.project;
      setProjects((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setItems((prev) =>
        prev.map((item) =>
          item.id === workspaceDetail.id ? { ...item, projectCount: item.projectCount + 1 } : item
        )
      );
      projectForm.reset({ name: '', relativePath: '', description: '' });
      setProjectDialogOpen(false);
      if (desktopAvailable && selectedTemplateId && window.api?.applyTemplateToProject) {
        try {
          setProjectError(null);
          setTemplateApplyMessage(null);
          const applyResp = await window.api.applyTemplateToProject({
            templateId: selectedTemplateId,
            workspaceRoot: workspaceDetail.rootPath,
            projectRelativePath: payload.relativePath
          });
          if (!applyResp?.ok) {
            throw new Error(applyResp?.error || 'Template apply failed');
          }
          setTemplateApplyMessage(`Template applied to ${payload.relativePath}`);
        } catch (applyErr) {
          const message = applyErr instanceof Error ? applyErr.message : 'Template apply failed';
          setProjectError(message);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setProjectError(message);
    }
  };

  const handleSaveWorkspaceTemplates = async () => {
    if (!workspaceDetail?.rootPath || !window.api?.saveWorkspaceTemplates) {
      setWorkspaceTemplateDialogOpen(false);
      return;
    }
    setWorkspaceTemplateSaving(true);
    setWorkspaceTemplateError(null);
    try {
      const resp = await window.api.saveWorkspaceTemplates({
        workspaceRoot: workspaceDetail.rootPath,
        templateIds: workspaceTemplateDraft
      });
      if (!resp.ok) {
        throw new Error(resp.error || 'Failed to save workspace templates');
      }
      const templateIds = resp.templateIds ?? workspaceTemplateDraft;
      setWorkspaceTemplateIds(templateIds);
      const selectedTemplates = resp.templates ?? allTemplates.filter((tpl) => templateIds.includes(tpl.id));
      setWorkspaceTemplates(selectedTemplates);
      const templateCount = templateIds.length;
      setWorkspaceDetail((prev) =>
        prev ? { ...prev, templateCount, status: templateCount > 0 ? 'healthy' : prev.status } : prev
      );
      setItems((prev) =>
        prev.map((ws) =>
          ws.id === workspaceDetail.id ? { ...ws, templateCount, status: templateCount > 0 ? 'healthy' : ws.status } : ws
        )
      );
      setWorkspaceTemplateDialogOpen(false);
    } catch (err) {
      setWorkspaceTemplateError(err instanceof Error ? err.message : 'Failed to save workspace templates');
    } finally {
      setWorkspaceTemplateSaving(false);
    }
  };

  const openProjectFolderPicker = async () => {
    if (selectingFolder || !canSelectFolder) return;
    try {
      setSelectingFolder(true);
      const result = await window.api?.selectDirectory?.();
      if (!result || result.canceled || !result.path) return;
      workspaceForm.setValue('rootPath', result.path, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true
      });
    } catch (err) {
      console.error('Failed to select folder', err);
      workspaceForm.setError('rootPath', { type: 'manual', message: 'Unable to select folder' });
    } finally {
      setSelectingFolder(false);
    }
  };

  const openProjectInExplorer = async (project: WorkspaceProject) => {
    if (!workspaceDetail?.rootPath) return;
    await window.api?.openPath?.(buildAbsolutePath(workspaceDetail.rootPath, project.relativePath));
  };

  const triggerFsDialog = (mode: 'folder' | 'file', project: WorkspaceProject) => {
    setFsError(null);
    setFsSuccess(null);
    if (mode === 'folder') {
      folderForm.reset({ folderName: '' });
    } else {
      fileForm.reset({ fileName: '', content: '' });
    }
    setFsDialog({ mode, project });
  };

  const handleCreateFolder = async (values: FolderFormValues) => {
    if (!fsDialog || !workspaceDetail?.rootPath || !desktopAvailable) return;
    const segment = sanitizeRelativeSegment(values.folderName);
    if (!segment) {
      folderForm.setError('folderName', { type: 'manual', message: 'Folder name is required' });
      return;
    }
    const targetPath = combineRelativePaths(fsDialog.project.relativePath, segment);
    try {
      const resp = await window.api?.createDirectory?.({
        rootPath: workspaceDetail.rootPath,
        relativePath: targetPath
      });
      if (!resp?.ok) {
        throw new Error(resp?.error || 'Failed to create folder');
      }
      setFsSuccess(`Created ${resp.path}`);
      setFsDialog(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create folder';
      setFsError(message);
    }
  };

  const handleCreateFile = async (values: FileFormValues) => {
    if (!fsDialog || !workspaceDetail?.rootPath || !desktopAvailable) return;
    const fileName = sanitizeRelativeSegment(values.fileName);
    if (!fileName) {
      fileForm.setError('fileName', { type: 'manual', message: 'File name is required' });
      return;
    }
    const targetPath = combineRelativePaths(fsDialog.project.relativePath, fileName);
    try {
      const resp = await window.api?.writeTextFile?.({
        rootPath: workspaceDetail.rootPath,
        relativePath: targetPath,
        content: values.content ?? ''
      });
      if (!resp?.ok) {
        throw new Error(resp?.error || 'Failed to create file');
      }
      setFsSuccess(`Created ${resp.path}`);
      setFsDialog(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create file';
      setFsError(message);
    }
  };

  const selectedWorkspace = useMemo(
    () => items.find((item) => item.id === selectedWorkspaceId) ?? null,
    [items, selectedWorkspaceId]
  );

  return (
    <PageShell
      title="Workspaces"
      description="Inventory of indexed workspaces and their status."
      toolbar={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            className="flex items-center gap-2"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin size-4" /> : <RefreshCw className="size-4" />}
            Refresh
          </Button>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">
                New Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New workspace</DialogTitle>
                <DialogDescription>Create a new workspace to be indexed by the system.</DialogDescription>
              </DialogHeader>
              <Form {...workspaceForm}>
                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={workspaceForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Workspace name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={workspaceForm.control}
                    name="rootPath"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Root path</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input {...field} placeholder="/path/to/repo" />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={openProjectFolderPicker}
                              disabled={!canSelectFolder || selectingFolder}
                              className="whitespace-nowrap"
                            >
                              <FolderOpen className="size-4 mr-2" />
                              {canSelectFolder ? (selectingFolder ? 'Selecting...' : 'Choose') : 'Desktop only'}
                            </Button>
                          </div>
                        </FormControl>
                        {!canSelectFolder ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            Folder picker currently requires the desktop shell; enter the path manually when running in the
                            browser.
                          </p>
                        ) : null}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={workspaceForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Description (optional)</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Short description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter className="mt-4">
                  <div className="flex items-center gap-2">
                    <Button type="button" onClick={workspaceForm.handleSubmit(handleCreateWorkspace)} disabled={creating}>
                      {creating ? 'Creating...' : 'Create'}
                    </Button>
                    <DialogClose asChild>
                      <Button type="button" variant="ghost">
                        Cancel
                      </Button>
                    </DialogClose>
                  </div>
                </DialogFooter>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {error ? <div className="text-sm text-destructive mb-4">Error: {error}</div> : null}
      <div className="grid gap-6 lg:grid-cols-[2fr,1.2fr]">
        <div className="space-y-4">
          {loading && items.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin size-4" /> Loading workspaces...
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((ws) => {
                const templateCount = getWorkspaceTemplateCount(ws.id, ws.templateCount);
                const status = getWorkspaceStatus(ws.id, ws.status);
                return (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => setSelectedWorkspaceId(ws.id)}
                  className={`rounded-md border p-4 text-left transition ${
                    selectedWorkspaceId === ws.id ? 'border-primary shadow-sm' : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-base font-semibold text-foreground">{ws.name}</p>
                      <p className="text-xs text-muted-foreground break-all mt-1">{ws.rootPath}</p>
                    </div>
                    <Badge variant={status === 'healthy' ? 'default' : status === 'degraded' ? 'secondary' : 'outline'}>
                      {status}
                    </Badge>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <div>
                      Projects
                      <span className="ml-1 font-semibold text-foreground">{ws.projectCount}</span>
                    </div>
                    <div>
                      Templates
                      <span className="ml-1 font-semibold text-foreground">{templateCount}</span>
                    </div>
                  </div>
                </button>
              )})}
            </div>
          )}

          {total !== null && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
                {items.length} of {total} workspaces
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  Prev
                </Button>
                <div className="text-xs">Page {page}</div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={total !== null && page * pageSize >= total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border p-4">
          {detailLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin size-4" /> Loading workspace detail...
            </div>
          ) : selectedWorkspace && workspaceDetail ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-foreground">{workspaceDetail.name}</p>
                  <p className="text-xs text-muted-foreground break-all">{workspaceDetail.rootPath}</p>
                </div>
                <Button size="sm" variant="ghost" className="flex items-center gap-2" onClick={() => setEditDialogOpen(true)}>
                  <Pencil className="size-4" /> Edit
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {workspaceDetail.description || 'No description provided.'}
              </p>
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setWorkspaceTemplateDraft(workspaceTemplateIds);
                        setWorkspaceTemplateDialogOpen(true);
                      }}
                    >
                      Manage
                    </Button>
                  ) : null}
                </div>
                {workspaceTemplateError ? (
                  <p className="text-xs text-destructive">{workspaceTemplateError}</p>
                ) : null}
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
                <Button size="sm" variant="secondary" onClick={() => setProjectDialogOpen(true)}>
                  Add project
                </Button>
              </div>
              {projectError ? <p className="text-xs text-destructive">{projectError}</p> : null}
              {templateApplyMessage ? <p className="text-xs text-emerald-600">{templateApplyMessage}</p> : null}
              {projectLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading projects...
                </div>
              ) : projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No projects registered yet.</p>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <div key={project.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm text-foreground">{project.name}</p>
                          <p className="text-xs text-muted-foreground break-all">{project.relativePath}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openProjectInExplorer(project)}
                            className="flex items-center gap-1"
                          >
                            <FolderOpen className="size-4" /> Open
                          </Button>
                        </div>
                      </div>
                      {project.description ? (
                        <p className="text-xs text-muted-foreground mt-2">{project.description}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!desktopAvailable}
                          onClick={() => triggerFsDialog('folder', project)}
                          className="flex items-center gap-1"
                        >
                          <FolderPlus className="size-4" /> New folder
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!desktopAvailable}
                          onClick={() => triggerFsDialog('file', project)}
                          className="flex items-center gap-1"
                        >
                          <FilePlus className="size-4" /> New file
                        </Button>
                      </div>
                      {!desktopAvailable ? (
                        <p className="text-[11px] text-muted-foreground mt-2">
                          Desktop shell required for file operations.
                        </p>
                      ) : null}
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Added {formatDate(project.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {detailError ? <p className="text-xs text-destructive">Error: {detailError}</p> : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a workspace to see details and manage projects.</p>
          )}
        </div>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit workspace</DialogTitle>
          </DialogHeader>
          <Form {...editWorkspaceForm}>
            <div className="space-y-4">
              <FormField
                control={editWorkspaceForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editWorkspaceForm.control}
                name="rootPath"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Root path</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editWorkspaceForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" onClick={editWorkspaceForm.handleSubmit(handleUpdateWorkspace)}>
                Save changes
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Link a subfolder to manage as a project.</DialogDescription>
          </DialogHeader>
          <Form {...projectForm}>
            <div className="space-y-4">
              <FormField
                control={projectForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Docs, API, etc." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
                <FormField
                  control={projectForm.control}
                  name="relativePath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Folder path</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="apps/docs"
                          onChange={(event) => {
                            setProjectPathEdited(true);
                            field.onChange(event);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
              />
              <FormField
                control={projectForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Optional details" />
                    </FormControl>
                  </FormItem>
                )}
              />
              {desktopAvailable ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Template (optional)</p>
                  <Select
                    value={selectedTemplateId}
                    onValueChange={setSelectedTemplateId}
                    disabled={templateLoading || availableTemplates.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          availableTemplates.length
                            ? 'Choose template'
                            : templateLoading
                              ? 'Loading templates...'
                              : 'No templates available'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Templates</SelectLabel>
                        {availableTemplates.map((tpl) => (
                          <SelectItem key={tpl.id} value={tpl.id}>
                            {tpl.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {templateError ? <p className="text-xs text-destructive">{templateError}</p> : null}
                  {!availableTemplates.length && !templateLoading ? (
                    <p className="text-xs text-muted-foreground">
                      Capture templates in the Templates tab and assign them to this workspace.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" onClick={projectForm.handleSubmit(handleCreateProject)}>
                Add project
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={workspaceTemplateDialogOpen}
        onOpenChange={(open) => {
          setWorkspaceTemplateDialogOpen(open);
          if (!open) {
            setWorkspaceTemplateError(null);
          } else {
            setWorkspaceTemplateDraft(workspaceTemplateIds);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workspace templates</DialogTitle>
            <DialogDescription>Select global templates that should be offered when creating new projects in this workspace.</DialogDescription>
          </DialogHeader>
          {templateLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading templates...
            </div>
          ) : allTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No templates available yet. Capture or create one in the Templates tab first.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {allTemplates.map((tpl) => {
                const checked = workspaceTemplateDraft.includes(tpl.id);
                return (
                  <label key={tpl.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setWorkspaceTemplateDraft((draft) =>
                          event.target.checked ? [...draft, tpl.id] : draft.filter((id) => id !== tpl.id)
                        );
                      }}
                    />
                    <span>{tpl.name}</span>
                  </label>
                );
              })}
            </div>
          )}
          {workspaceTemplateError ? <p className="text-xs text-destructive">{workspaceTemplateError}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={handleSaveWorkspaceTemplates}
              disabled={workspaceTemplateSaving || allTemplates.length === 0}
            >
              {workspaceTemplateSaving ? 'Saving...' : 'Save'}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={fsDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFsDialog(null);
            setFsError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {fsDialog?.mode === 'folder'
                ? `Create folder in ${fsDialog?.project.name}`
                : `Create file in ${fsDialog?.project.name}`}
            </DialogTitle>
            {!desktopAvailable ? (
              <DialogDescription>Desktop shell required for filesystem operations.</DialogDescription>
            ) : null}
          </DialogHeader>
          {fsError ? <p className="text-xs text-destructive">{fsError}</p> : null}
          {fsDialog?.mode === 'folder' ? (
            <Form {...folderForm}>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void folderForm.handleSubmit(handleCreateFolder)(event);
                }}
              >
                <FormField
                  control={folderForm.control}
                  name="folderName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Folder name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="documentation" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={!desktopAvailable}>
                    Create folder
                  </Button>
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">
                      Cancel
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </form>
            </Form>
          ) : fsDialog?.mode === 'file' ? (
            <Form {...fileForm}>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void fileForm.handleSubmit(handleCreateFile)(event);
                }}
              >
                <FormField
                  control={fileForm.control}
                  name="fileName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>File name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="README.md" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={fileForm.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial content</FormLabel>
                      <FormControl>
                        <Textarea rows={6} {...field} placeholder="# Notes" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={!desktopAvailable}>
                    Create file
                  </Button>
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">
                      Cancel
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </form>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>

      {fsSuccess ? <p className="mt-4 text-sm text-emerald-600">{fsSuccess}</p> : null}
    </PageShell>
  );
};
const slugifyPath = (value: string) => {
  const sanitized = sanitizeRelativeSegment(value ?? '');
  if (!sanitized) return '';
  return sanitized
    .replace(/[^\w/-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
};
