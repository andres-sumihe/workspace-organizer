import { Layers, Loader2, AlertCircle, PlusCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { BuilderMeta, CaptureFormValues, EditableFile, EditableFolder, EditableToken } from '@/features/templates';
import type { TemplateTokenEntry } from '@/types/desktop';
import type { TemplateSummaryV2 } from '@workspace/shared';

import { fetchTemplateList, fetchWorkspaceTemplates, assignTemplateToWorkspace, unassignTemplateFromWorkspace } from '@/api/templates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { makeId, normalizePathInput } from '@/features/templates';

interface WorkspaceTemplatesTabProps {
  workspaceId: string;
}

export const WorkspaceTemplatesTab = ({ workspaceId }: WorkspaceTemplatesTabProps) => {
  const [allTemplates, setAllTemplates] = useState<TemplateSummaryV2[]>([]);
  const [workspaceTemplates, setWorkspaceTemplates] = useState<TemplateSummaryV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Template creation state
  const [desktopAvailable, setDesktopAvailable] = useState(false);
  const [view, setView] = useState<'list' | 'capture' | 'builder'>('list');
  const [captureSubmitting, setCaptureSubmitting] = useState(false);
  const [builderTemplateId, setBuilderTemplateId] = useState<string | null>(null);
  const [builderLoading, setBuilderLoading] = useState(false);
  const [builderSaving, setBuilderSaving] = useState(false);
  const [builderFolders, setBuilderFolders] = useState<EditableFolder[]>([]);
  const [builderFiles, setBuilderFiles] = useState<EditableFile[]>([]);
  const [builderTokens, setBuilderTokens] = useState<EditableToken[]>([]);
  const [builderError, setBuilderError] = useState<string | null>(null);

  const captureForm = useForm<CaptureFormValues>({
    defaultValues: { name: '', description: '', sourcePath: '' }
  });

  const builderForm = useForm<BuilderMeta>({
    defaultValues: { name: '', description: '' }
  });

  useEffect(() => {
    setDesktopAvailable(typeof window !== 'undefined' && typeof window.api?.listTemplates === 'function');
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [all, workspace] = await Promise.all([
        fetchTemplateList(),
        fetchWorkspaceTemplates(workspaceId)
      ]);

      setAllTemplates(all);
      setWorkspaceTemplates(workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleToggleTemplate = async (templateId: string, isAssigned: boolean) => {
    try {
      if (isAssigned) {
        await unassignTemplateFromWorkspace(workspaceId, templateId);
      } else {
        await assignTemplateToWorkspace(workspaceId, templateId);
      }
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template assignment');
    }
  };

  const isTemplateAssigned = (templateId: string) => {
    return workspaceTemplates.some((t) => t.id === templateId);
  };

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
      setView('list');
      captureForm.reset({ name: '', description: '', sourcePath: '' });
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    } finally {
      setCaptureSubmitting(false);
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
    setView('builder');
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
      setBuilderFolders((manifest.folders || []).map((folder: any) => ({ id: makeId(), path: folder.path || '' })));
      setBuilderFiles(
        (manifest.files || []).map((file: any) => ({
          id: makeId(),
          path: file.path || '',
          content: file.content || ''
        }))
      );
      setBuilderTokens(
        (manifest.tokens || []).map((token: any) => ({
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
      .map((file) => (file.path.trim() ? { path: normalizePathInput(file.path.trim()), content: file.content } : null))
      .filter((entry): entry is { path: string; content: string } => 
        entry !== null && 
        builderFiles.findIndex(f => f.path.trim() && normalizePathInput(f.path.trim()) === entry.path) >= 0
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
      setView('list');
      await loadTemplates();
    } catch (err) {
      setBuilderError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setBuilderSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <p>{error}</p>
      </div>
    );
  }

  // Capture form view
  if (view === 'capture') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Capture Template from Folder</h3>
          <Button variant="ghost" size="sm" onClick={() => setView('list')}>
            ← Back to list
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <Form {...captureForm}>
              <form onSubmit={captureForm.handleSubmit(handleCaptureTemplate)} className="space-y-4">
                <FormField
                  control={captureForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="My Template" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={captureForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Template description" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={captureForm.control}
                  name="sourcePath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Folder</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input {...field} placeholder="/path/to/folder" />
                          <Button type="button" variant="outline" onClick={pickSourceFolder}>
                            Browse
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setView('list')}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={captureSubmitting}>
                    {captureSubmitting ? 'Capturing...' : 'Capture Template'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Builder form view
  if (view === 'builder') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{builderTemplateId ? 'Edit Template' : 'Create Blank Template'}</h3>
          <Button variant="ghost" size="sm" onClick={() => setView('list')}>
            ← Back to list
          </Button>
        </div>
        {builderLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 space-y-6">
              {builderError && <div className="text-sm text-destructive">{builderError}</div>}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input {...builderForm.register('name', { required: true })} placeholder="Template name" />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea {...builderForm.register('description')} placeholder="Optional description" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Folders</label>
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
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeFolderRow(folder.id)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Files</label>
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
                        <Button type="button" size="sm" variant="ghost" onClick={() => removeFileRow(file.id)}>
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
                  <label className="text-sm font-medium">Tokens</label>
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
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeTokenRow(token.id)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setView('list')}>
                  Cancel
                </Button>
                <Button onClick={handleSaveTemplate} disabled={builderSaving}>
                  {builderSaving ? 'Saving...' : 'Save template'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Template list view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Template Library</h3>
          <p className="text-sm text-muted-foreground">
            {allTemplates.length} {allTemplates.length === 1 ? 'template' : 'templates'} available • {workspaceTemplates.length} assigned
          </p>
        </div>
        {desktopAvailable && allTemplates.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setView('capture')}>
              <PlusCircle className="size-4 mr-2" />
              Capture from Folder
            </Button>
            <Button size="sm" onClick={() => openBuilder(undefined)}>
              <PlusCircle className="size-4 mr-2" />
              Create Blank Template
            </Button>
          </div>
        )}
      </div>

      {allTemplates.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center space-y-4">
          <Layers className="mx-auto size-12 text-muted-foreground/50" />
          <div>
            <h3 className="text-sm font-semibold mb-2">No Templates Available</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
              Templates are reusable folder and file structures. Create a template to get started.
            </p>
          </div>
          {desktopAvailable && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={() => setView('capture')}>
                <PlusCircle className="size-4 mr-2" />
                Capture from Folder
              </Button>
              <Button onClick={() => openBuilder(undefined)}>
                <PlusCircle className="size-4 mr-2" />
                Create Blank Template
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allTemplates.map((template) => {
            const assigned = isTemplateAssigned(template.id);
            return (
              <Card key={template.id} className={assigned ? 'border-primary' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        {assigned && <Badge variant="secondary" className="text-xs">Assigned</Badge>}
                      </div>
                      <CardDescription className="line-clamp-2">{template.description || 'No description'}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <div>{template.folderCount} folders</div>
                      <div>{template.fileCount} files</div>
                    </div>
                    <Button
                      size="sm"
                      variant={assigned ? 'outline' : 'default'}
                      onClick={() => handleToggleTemplate(template.id, assigned)}
                    >
                      {assigned ? 'Unassign' : 'Assign'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
