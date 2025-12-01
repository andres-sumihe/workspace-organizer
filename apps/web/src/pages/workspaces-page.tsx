import { Plus, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import type { BuilderMeta, CaptureFormValues, EditableFile, EditableFolder, EditableToken } from '@/features/templates';
import type { WorkspaceFormValues } from '@/features/workspaces';
import type { TemplateManifest, TemplateSummary, TemplateTokenEntry } from '@/types/desktop';

import { createWorkspace } from '@/api/workspaces';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { TemplateGrid, TemplatesToolbar, makeId, normalizePathInput } from '@/features/templates';
import { WorkspaceListPanel } from '@/features/workspaces';

export function WorkspacesPage() {
  const navigate = useNavigate();
  const {
    workspaces,
    refreshWorkspaces,
    loading,
    error: contextError
  } = useWorkspaceContext();

  const [localError, setLocalError] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  // Template management state
  const [templatesSheetOpen, setTemplatesSheetOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [desktopAvailable, setDesktopAvailable] = useState(false);

  const [captureDialogOpen, setCaptureDialogOpen] = useState(false);
  const [captureSubmitting, setCaptureSubmitting] = useState(false);

  const [builderDialogOpen, setBuilderDialogOpen] = useState(false);
  const [builderTemplateId, setBuilderTemplateId] = useState<string | null>(null);
  const [builderLoading, setBuilderLoading] = useState(false);
  const [builderSaving, setBuilderSaving] = useState(false);
  const [builderFolders, setBuilderFolders] = useState<EditableFolder[]>([]);
  const [builderFiles, setBuilderFiles] = useState<EditableFile[]>([]);
  const [builderTokens, setBuilderTokens] = useState<EditableToken[]>([]);
  const [builderError, setBuilderError] = useState<string | null>(null);

  const workspaceForm = useForm<WorkspaceFormValues>({
    defaultValues: { name: '', rootPath: '', description: '' }
  });

  const captureForm = useForm<CaptureFormValues>({
    defaultValues: { name: '', description: '', sourcePath: '' }
  });

  const builderForm = useForm<BuilderMeta>({
    defaultValues: { name: '', description: '' }
  });

  const error = contextError || localError;
  const total = workspaces.length;
  const paginatedItems = workspaces.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setDesktopAvailable(typeof window !== 'undefined' && typeof window.api?.listTemplates === 'function');
  }, []);

  const loadTemplates = useCallback(async () => {
    if (!desktopAvailable) return;
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const response = await window.api?.listTemplates?.();
      if (!response?.ok || !response.templates) {
        throw new Error(response?.error || 'Unable to load templates');
      }
      setTemplates(response.templates);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load templates';
      setTemplatesError(message);
    } finally {
      setTemplatesLoading(false);
    }
  }, [desktopAvailable]);

  useEffect(() => {
    if (templatesSheetOpen) {
      void loadTemplates();
    }
  }, [templatesSheetOpen, loadTemplates]);

  const formattedTemplates = useMemo(
    () =>
      templates.map((tpl) => ({
        ...tpl,
        createdDate: new Date(tpl.createdAt).toLocaleString()
      })),
    [templates]
  );

  const pickSourceFolder = async () => {
    const result = await window.api?.selectDirectory?.();
    if (!result || result.canceled || !result.path) return;
    captureForm.setValue('sourcePath', result.path, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true
    });
  };

  const handleCaptureTemplate = async (values: CaptureFormValues) => {
    if (!desktopAvailable) return;
    if (!values.sourcePath) {
      captureForm.setError('sourcePath', { type: 'manual', message: 'Source folder is required' });
      return;
    }
    setCaptureSubmitting(true);
    try {
      const response = await window.api?.createTemplateFromFolder?.({
        name: values.name?.trim(),
        description: values.description?.trim(),
        sourcePath: values.sourcePath
      });
      if (!response?.ok || !response.template) {
        throw new Error(response?.error || 'Failed to create template');
      }
      const manifest = response.template as TemplateManifest;
      const summary: TemplateSummary = {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        createdAt: manifest.createdAt ?? new Date().toISOString(),
        updatedAt: manifest.updatedAt,
        folderCount: manifest.folders?.length ?? 0,
        fileCount: manifest.files?.length ?? 0
      };
      setTemplates((prev) => [summary, ...prev]);
      setCaptureDialogOpen(false);
      captureForm.reset({ name: '', description: '', sourcePath: '' });
    } catch (err) {
      setTemplatesError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setCaptureSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!desktopAvailable) return;
    if (!window.confirm('Delete this template? This cannot be undone.')) return;
    try {
      const response = await window.api?.deleteTemplate?.({ templateId });
      if (!response?.ok) {
        throw new Error(response?.error || 'Failed to delete template');
      }
      setTemplates((prev) => prev.filter((tpl) => tpl.id !== templateId));
    } catch (err) {
      setTemplatesError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  const resetBuilderState = () => {
    builderForm.reset({ name: '', description: '' });
    setBuilderTemplateId(null);
    setBuilderFolders([]);
    setBuilderFiles([]);
    setBuilderTokens([]);
    setBuilderError(null);
  };

  const openBuilder = async (templateId?: string) => {
    if (!desktopAvailable) return;
    resetBuilderState();
    setBuilderDialogOpen(true);
    if (!templateId) {
      setBuilderFolders([{ id: makeId(), path: 'src' }]);
      setBuilderFiles([{ id: makeId(), path: 'README.md', content: '# Project' }]);
      setBuilderTokens([]);
      return;
    }

    setBuilderLoading(true);
    setBuilderTemplateId(templateId);
    try {
      const response = await window.api?.getTemplateManifest?.({ templateId });
      if (!response?.ok || !response.manifest) {
        throw new Error(response?.error || 'Failed to load template');
      }
      const manifest = response.manifest;
      builderForm.reset({ name: manifest.name, description: manifest.description ?? '' });
      setBuilderFolders((manifest.folders || []).map((folder) => ({ id: makeId(), path: folder.path || '' })));
      setBuilderFiles(
        (manifest.files || []).map((file) => ({
          id: makeId(),
          path: file.path || '',
          content: file.content || ''
        }))
      );
      setBuilderTokens(
        (manifest.tokens || []).map((token) => ({
          id: makeId(),
          key: token.key,
          label: token.label || '',
          defaultValue: token.default || ''
        }))
      );
    } catch (err) {
      setBuilderError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setBuilderLoading(false);
    }
  };

  const addFolderRow = () => setBuilderFolders((rows) => [...rows, { id: makeId(), path: '' }]);
  const updateFolderRow = (id: string, value: string) =>
    setBuilderFolders((rows) => rows.map((row) => (row.id === id ? { ...row, path: value } : row)));
  const removeFolderRow = (id: string) => setBuilderFolders((rows) => rows.filter((row) => row.id !== id));

  const addFileRow = () => setBuilderFiles((rows) => [...rows, { id: makeId(), path: '', content: '' }]);
  const updateFileRow = (id: string, patch: Partial<EditableFile>) =>
    setBuilderFiles((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const removeFileRow = (id: string) => setBuilderFiles((rows) => rows.filter((row) => row.id !== id));

  const addTokenRow = () => setBuilderTokens((rows) => [...rows, { id: makeId(), key: '', label: '', defaultValue: '' }]);
  const updateTokenRow = (id: string, patch: Partial<EditableToken>) =>
    setBuilderTokens((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const removeTokenRow = (id: string) => setBuilderTokens((rows) => rows.filter((row) => row.id !== id));

  const handleSaveTemplate = async () => {
    const values = builderForm.getValues();
    if (!values.name.trim()) {
      setBuilderError('Template name is required.');
      return;
    }

    const folders = builderFolders
      .map((folder) => folder.path.trim() && { path: normalizePathInput(folder.path.trim()) })
      .filter(Boolean) as { path: string }[];

    const files = builderFiles
      .map((file) => file.path.trim() ? { path: normalizePathInput(file.path.trim()), content: file.content } : null)
      .filter((entry): entry is { path: string; content: string } => 
        entry !== null && !files.some((f, i, arr) => arr.findIndex(other => other?.path === f?.path) < i)
      );

    if (!folders.length && !files.length) {
      setBuilderError('Add at least one folder or file.');
      return;
    }

    const tokens = builderTokens
      .map((token) => token.key.trim() && { key: token.key.trim(), label: token.label?.trim(), default: token.defaultValue })
      .filter(Boolean) as TemplateTokenEntry[];

    setBuilderSaving(true);
    try {
      if (!window.api?.saveTemplateManifest) {
        throw new Error('Desktop API not available');
      }
      const response = await window.api.saveTemplateManifest({
        id: builderTemplateId ?? undefined,
        name: values.name.trim(),
        description: values.description?.trim(),
        folders,
        files,
        tokens
      });
      if (!response.ok || !response.template) {
        throw new Error(response.error || 'Failed to save template');
      }
      const manifest = response.template as TemplateManifest;
      const summary: TemplateSummary = {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        createdAt: manifest.createdAt ?? new Date().toISOString(),
        updatedAt: manifest.updatedAt,
        folderCount: manifest.folders?.length ?? 0,
        fileCount: manifest.files?.length ?? 0
      };
      setTemplates((prev) => {
        const exists = prev.findIndex((tpl) => tpl.id === summary.id);
        if (exists === -1) {
          return [summary, ...prev];
        }
        const clone = [...prev];
        clone[exists] = { ...clone[exists], ...summary };
        return clone;
      });
      setBuilderDialogOpen(false);
    } catch (err) {
      setBuilderError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setBuilderSaving(false);
    }
  };

  const handleCreateWorkspace = async (values: WorkspaceFormValues) => {
    setCreating(true);
    setLocalError(null);

    try {
      const result = await createWorkspace({
        name: values.name,
        rootPath: values.rootPath,
        description: values.description || undefined
      }) as { workspace: { id: string } };

      await refreshWorkspaces();
      setOpenNew(false);
      workspaceForm.reset();

      // Navigate to the new workspace detail page
      navigate(`/workspaces/${result.workspace.id}`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageShell
      title="Workspaces"
      description="Manage workspace inventory, indexing cadence, and template associations."
      toolbar={
        <div className="flex justify-end">
          <Button onClick={() => setOpenNew(true)} className="gap-2">
            <Plus className="size-4" />
            New Workspace
          </Button>
        </div>
      }
    >
      {error ? <div className="mb-4 text-sm text-destructive">Error: {error}</div> : null}

      <WorkspaceListPanel
        items={paginatedItems}
        loading={loading}
        selectedWorkspaceId={null}
        onSelect={(id) => navigate(`/workspaces/${id}`)}
        getTemplateCount={(wsId) => {
          const ws = workspaces.find((w) => w.id === wsId);
          return ws?.templateCount ?? 0;
        }}
        getWorkspaceStatus={(wsId, fallback) => {
          const ws = workspaces.find((w) => w.id === wsId);
          return ws?.status ?? fallback;
        }}
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
      />

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>Enter details for the new workspace</DialogDescription>
          </DialogHeader>

          <form onSubmit={workspaceForm.handleSubmit(handleCreateWorkspace)} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...workspaceForm.register('name', { required: true })} placeholder="My Workspace" />
            </div>

            <div>
              <Label htmlFor="rootPath">Root Path</Label>
              <Input
                id="rootPath"
                {...workspaceForm.register('rootPath', { required: true })}
                placeholder="C:\Projects\MyWorkspace"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...workspaceForm.register('description')}
                placeholder="Optional description"
              />
            </div>

            {localError && <div className="text-sm text-destructive">{localError}</div>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpenNew(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Templates Management Sheet */}
      <Sheet open={templatesSheetOpen} onOpenChange={setTemplatesSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Template Library</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {!desktopAvailable ? (
              <div className="rounded-md border border-dashed border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Templates require the desktop shell. Launch via <code>npm run dev:desktop</code> to design, capture, and apply them.
              </div>
            ) : null}
            
            {templatesError ? <p className="text-sm text-destructive">{templatesError}</p> : null}

            {/* Show builder inside sheet when creating/editing */}
            {builderDialogOpen ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {builderTemplateId ? 'Edit template' : 'Create template'}
                  </h3>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setBuilderDialogOpen(false);
                      resetBuilderState();
                    }}
                  >
                    ← Back to list
                  </Button>
                </div>

                {builderLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {builderError ? (
                      <div className="text-sm text-destructive">{builderError}</div>
                    ) : null}

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="builder-name">Name</Label>
                        <Input
                          id="builder-name"
                          {...builderForm.register('name', { required: true })}
                          placeholder="Template name"
                        />
                      </div>

                      <div>
                        <Label htmlFor="builder-description">Description</Label>
                        <Textarea
                          id="builder-description"
                          {...builderForm.register('description')}
                          placeholder="Optional description"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Folders</Label>
                        <Button type="button" size="sm" variant="outline" onClick={addFolderRow}>
                          Add folder
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {builderFolders.map((folder) => (
                          <div key={folder.id} className="flex gap-2">
                            <Input
                              value={folder.path}
                              onChange={(e) => updateFolderRow(folder.id, e.target.value)}
                              placeholder="src"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFolderRow(folder.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Files</Label>
                        <Button type="button" size="sm" variant="outline" onClick={addFileRow}>
                          Add file
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {builderFiles.map((file) => (
                          <div key={file.id} className="space-y-2 rounded-md border p-3">
                            <div className="flex gap-2">
                              <Input
                                value={file.path}
                                onChange={(e) => updateFileRow(file.id, { path: e.target.value })}
                                placeholder="README.md"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removeFileRow(file.id)}
                              >
                                Remove
                              </Button>
                            </div>
                            <Textarea
                              value={file.content}
                              onChange={(e) => updateFileRow(file.id, { content: e.target.value })}
                              placeholder="File content"
                              rows={3}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Tokens</Label>
                        <Button type="button" size="sm" variant="outline" onClick={addTokenRow}>
                          Add token
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {builderTokens.map((token) => (
                          <div key={token.id} className="flex gap-2">
                            <Input
                              value={token.key}
                              onChange={(e) => updateTokenRow(token.id, { key: e.target.value })}
                              placeholder="clientName"
                              className="flex-1"
                            />
                            <Input
                              value={token.label}
                              onChange={(e) => updateTokenRow(token.id, { label: e.target.value })}
                              placeholder="Client Name"
                              className="flex-1"
                            />
                            <Input
                              value={token.defaultValue}
                              onChange={(e) => updateTokenRow(token.id, { defaultValue: e.target.value })}
                              placeholder="Default"
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeTokenRow(token.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setBuilderDialogOpen(false);
                          resetBuilderState();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleSaveTemplate} disabled={builderSaving}>
                        {builderSaving ? 'Saving...' : 'Save template'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <TemplatesToolbar
                  desktopAvailable={desktopAvailable}
                  loading={templatesLoading}
                  onRefresh={() => void loadTemplates()}
                  captureDialogOpen={captureDialogOpen}
                  onCaptureDialogChange={(open) => {
                    setCaptureDialogOpen(open);
                    if (!open) captureForm.reset({ name: '', description: '', sourcePath: '' });
                  }}
                  captureForm={captureForm}
                  captureSubmitting={captureSubmitting}
                  onCaptureSubmit={handleCaptureTemplate}
                  onSelectSource={pickSourceFolder}
                  onCreateBlank={() => {
                    setBuilderDialogOpen(true);
                    setBuilderFolders([{ id: makeId(), path: 'src' }]);
                    setBuilderFiles([{ id: makeId(), path: 'README.md', content: '# Project' }]);
                    setBuilderTokens([]);
                  }}
                />

                <TemplateGrid 
                  templates={formattedTemplates} 
                  loading={templatesLoading} 
                  onEdit={(templateId) => {
                    setBuilderDialogOpen(true);
                    void openBuilder(templateId);
                  }} 
                  onDelete={handleDeleteTemplate} 
                />
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
