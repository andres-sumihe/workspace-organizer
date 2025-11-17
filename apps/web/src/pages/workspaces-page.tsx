import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import type {
  FileFormValues,
  FolderFormValues,
  FsDialogState,
  ProjectFormValues,
  WorkspaceFormValues
} from '@/features/workspaces';
import type { TemplateSummary } from '@/types/desktop';
import type { WorkspaceDetail, WorkspaceProject, WorkspaceSummary } from '@workspace/shared';

import {
  createWorkspace,
  createWorkspaceProject,
  fetchWorkspaceDetail,
  fetchWorkspaceProjects,
  updateWorkspace as updateWorkspaceApi
} from '@/api/workspaces';
import { PageShell } from '@/components/layout/page-shell';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import {
  WorkspaceToolbar,
  WorkspaceListPanel,
  WorkspaceDetailPanel,
  EditWorkspaceDialog,
  ProjectDialog,
  WorkspaceTemplatesDialog,
  FsDialog,
  combineRelativePaths,
  buildAbsolutePath,
  sanitizeRelativeSegment,
  slugifyPath
} from '@/features/workspaces';

export const WorkspacesPage = () => {
  const {
    workspaces: items,
    activeWorkspaceId: selectedWorkspaceId,
    setActiveWorkspaceId: setSelectedWorkspaceId,
    refreshWorkspaces,
    loading: contextLoading,
    error: contextError
  } = useWorkspaceContext();

  const [localError, setLocalError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(6);
  const [openNew, setOpenNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [canSelectFolder, setCanSelectFolder] = useState(false);
  const [workspaceDetail, setWorkspaceDetail] = useState<WorkspaceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updatingWorkspace, setUpdatingWorkspace] = useState(false);

  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [templateApplyMessage, setTemplateApplyMessage] = useState<string | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [desktopAvailable, setDesktopAvailable] = useState(false);
  const [fsDialog, setFsDialog] = useState<FsDialogState | null>(null);
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

  const folderForm = useForm<FolderFormValues>({ defaultValues: { folderName: '' } });
  const fileForm = useForm<FileFormValues>({ defaultValues: { fileName: '', content: '' } });

  const [projectPathEdited, setProjectPathEdited] = useState(false);

  // Derive pagination values from context workspaces
  const loading = contextLoading;
  const error = contextError || localError;
  const total = items.length;
  const paginatedItems = useMemo(() => {
    const startIdx = (page - 1) * pageSize;
    return items.slice(startIdx, startIdx + pageSize);
  }, [items, page, pageSize]);

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
        await refreshWorkspaces();
      } catch (err) {
        console.error('Failed to load workspace templates', err);
        setWorkspaceTemplates([]);
        setWorkspaceTemplateIds([]);
      }
    },
    [desktopAvailable, refreshWorkspaces]
  );

  const loadDetailAndProjects = useCallback(
    async (workspaceId: string) => {
      setDetailLoading(true);
      setProjectLoading(true);
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
        setLocalError(message);
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
        await refreshWorkspaces();
        setSelectedWorkspaceId(created.id);
        workspaceForm.reset();
        setOpenNew(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create workspace';
      setLocalError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateWorkspace = async (values: WorkspaceFormValues) => {
    if (!workspaceDetail) return;
    setUpdatingWorkspace(true);
    try {
      const resp = await updateWorkspaceApi(workspaceDetail.id, {
        name: values.name?.trim(),
        rootPath: values.rootPath?.trim(),
        description: values.description?.trim()
      });
      const updated = (resp as unknown as { workspace?: WorkspaceDetail }).workspace;
      if (updated) {
        setWorkspaceDetail(updated);
        await refreshWorkspaces();
        setEditDialogOpen(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update workspace';
      setLocalError(message);
    } finally {
      setUpdatingWorkspace(false);
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
      await refreshWorkspaces();
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
      setWorkspaceDetail((prev) => (prev ? { ...prev, templateCount, status: templateCount > 0 ? 'healthy' : prev.status } : prev));
      await refreshWorkspaces();
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

  const handleTemplatesDialogChange = (open: boolean) => {
    setWorkspaceTemplateDialogOpen(open);
    if (open) {
      setWorkspaceTemplateDraft(workspaceTemplateIds);
    } else {
      setWorkspaceTemplateError(null);
    }
  };

  const handleToggleWorkspaceTemplate = (templateId: string, checked: boolean) => {
    setWorkspaceTemplateDraft((draft) => (checked ? [...draft, templateId] : draft.filter((id) => id !== templateId)));
  };

  const handleFsDialogChange = (open: boolean) => {
    if (!open) {
      setFsDialog(null);
      setFsError(null);
    }
  };

  return (
    <PageShell
      title="Workspaces"
      description="Inventory of indexed workspaces and their status."
      toolbar={
        <WorkspaceToolbar
          loading={loading}
          onRefresh={() => void refreshWorkspaces()}
          createDialogOpen={openNew}
          onCreateDialogChange={setOpenNew}
          form={workspaceForm}
          onSubmit={handleCreateWorkspace}
          creating={creating}
          canSelectFolder={canSelectFolder}
          selectingFolder={selectingFolder}
          onSelectFolder={openProjectFolderPicker}
        />
      }
    >
      {error ? <div className="mb-4 text-sm text-destructive">Error: {error}</div> : null}
      <div className="grid gap-6 lg:grid-cols-[2fr,1.2fr]">
        <WorkspaceListPanel
          items={paginatedItems}
          loading={loading}
          selectedWorkspaceId={selectedWorkspaceId}
          onSelect={(id) => setSelectedWorkspaceId(id)}
          getTemplateCount={getWorkspaceTemplateCount}
          getWorkspaceStatus={getWorkspaceStatus}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
        <WorkspaceDetailPanel
          detailLoading={detailLoading}
          selectedWorkspace={selectedWorkspace}
          workspaceDetail={workspaceDetail}
          desktopAvailable={desktopAvailable}
          workspaceTemplates={workspaceTemplates}
          workspaceTemplateError={workspaceTemplateError}
          onManageTemplates={() => {
            setWorkspaceTemplateDraft(workspaceTemplateIds);
            setWorkspaceTemplateDialogOpen(true);
          }}
          projects={projects}
          projectLoading={projectLoading}
          projectError={projectError}
          templateApplyMessage={templateApplyMessage}
          onOpenProjectDialog={() => setProjectDialogOpen(true)}
          onEditWorkspace={() => setEditDialogOpen(true)}
          onOpenProjectInExplorer={openProjectInExplorer}
          onTriggerFsDialog={triggerFsDialog}
        />
      </div>

      <EditWorkspaceDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        form={editWorkspaceForm}
        onSubmit={handleUpdateWorkspace}
        saving={updatingWorkspace}
      />

      <ProjectDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        form={projectForm}
        onSubmit={handleCreateProject}
        desktopAvailable={desktopAvailable}
        availableTemplates={availableTemplates}
        templateLoading={templateLoading}
        templateError={templateError}
        selectedTemplateId={selectedTemplateId}
        onTemplateChange={setSelectedTemplateId}
        onPathManualEdit={() => setProjectPathEdited(true)}
      />

      <WorkspaceTemplatesDialog
        open={workspaceTemplateDialogOpen}
        onOpenChange={handleTemplatesDialogChange}
        templates={allTemplates}
        loading={templateLoading}
        draft={workspaceTemplateDraft}
        onToggleTemplate={handleToggleWorkspaceTemplate}
        onSave={handleSaveWorkspaceTemplates}
        saving={workspaceTemplateSaving}
        error={workspaceTemplateError}
      />

      <FsDialog
        state={fsDialog}
        open={fsDialog !== null}
        onOpenChange={handleFsDialogChange}
        folderForm={folderForm}
        fileForm={fileForm}
        onCreateFolder={handleCreateFolder}
        onCreateFile={handleCreateFile}
        desktopAvailable={desktopAvailable}
        error={fsError}
      />

      {fsSuccess ? <p className="mt-4 text-sm text-emerald-600">{fsSuccess}</p> : null}
    </PageShell>
  );
};
