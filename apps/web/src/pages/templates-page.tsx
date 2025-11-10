import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/page-shell';
import { Textarea } from '@/components/ui/textarea';

import { FileArchive, FolderOpen, Loader2, PenSquare, PlusCircle, Trash2 } from 'lucide-react';

interface CaptureFormValues {
  name: string;
  description?: string;
  sourcePath: string;
}

interface BuilderMeta {
  name: string;
  description?: string;
}

interface EditableFolder {
  id: string;
  path: string;
}

interface EditableFile {
  id: string;
  path: string;
  content: string;
}

interface EditableToken {
  id: string;
  key: string;
  label: string;
  defaultValue: string;
}

const normalizePathInput = (value: string) => value.replace(/\\/g, '/').replace(/^\/+/, '').trim();

const makeId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now() + Math.random()));

export const TemplatesPage = () => {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desktopAvailable, setDesktopAvailable] = useState(false);

  const captureForm = useForm<CaptureFormValues>({
    defaultValues: { name: '', description: '', sourcePath: '' }
  });

  const builderForm = useForm<BuilderMeta>({
    defaultValues: { name: '', description: '' }
  });

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

  useEffect(() => {
    setDesktopAvailable(typeof window !== 'undefined' && typeof window.api?.listTemplates === 'function');
  }, []);

  const loadTemplates = useCallback(async () => {
    if (!desktopAvailable) return;
    setLoading(true);
    setError(null);
    try {
      const response = await window.api?.listTemplates?.();
      if (!response?.ok || !response.templates) {
        throw new Error(response?.error || 'Unable to load templates');
      }
      setTemplates(response.templates);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load templates';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [desktopAvailable]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

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
      setError(err instanceof Error ? err.message : 'Failed to create template');
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
      setError(err instanceof Error ? err.message : 'Failed to delete template');
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
      setBuilderFolders(
        (manifest.folders || []).map((folder) => ({ id: makeId(), path: folder.path || '' }))
      );
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
    if (!desktopAvailable || !window.api?.saveTemplateManifest) return;
    setBuilderError(null);
    const values = builderForm.getValues();
    if (!values.name.trim()) {
      setBuilderError('Template name is required.');
      return;
    }
    const folders = builderFolders
      .map((folder) => normalizePathInput(folder.path))
      .filter((path, index, arr) => path && arr.indexOf(path) === index)
      .map((path) => ({ path }));

    const files = builderFiles
      .map((file) => {
        const path = normalizePathInput(file.path);
        if (!path) return null;
        return { path, content: file.content ?? '' };
      })
      .filter((entry, index, arr) => entry && arr.findIndex((other) => other?.path === entry?.path) === index) as {
      path: string;
      content: string;
    }[];

    if (!folders.length && !files.length) {
      setBuilderError('Add at least one folder or file.');
      return;
    }

    const tokens = builderTokens
      .map((token) => token.key.trim() && { key: token.key.trim(), label: token.label?.trim(), default: token.defaultValue })
      .filter(Boolean) as TemplateTokenEntry[];

    setBuilderSaving(true);
    try {
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

  return (
    <PageShell
      title="Project Templates"
      description="Capture folder structures once and reuse them when creating new projects."
      toolbar={
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" variant="outline" onClick={() => void loadTemplates()} disabled={loading || !desktopAvailable}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshIcon />}
            Refresh
          </Button>
          <Dialog
            open={captureDialogOpen}
            onOpenChange={(open) => {
              setCaptureDialogOpen(open);
              if (!open) captureForm.reset({ name: '', description: '', sourcePath: '' });
            }}
          >
            <DialogTrigger asChild>
              <Button type="button" size="sm" variant="secondary" disabled={!desktopAvailable}>
                <FolderOpen className="size-4 mr-2" />
                Capture existing folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Capture template</DialogTitle>
                <DialogDescription>Select an existing folder to turn into a reusable template.</DialogDescription>
              </DialogHeader>
              <Form {...captureForm}>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void captureForm.handleSubmit(handleCaptureTemplate)(event);
                  }}
                >
                  <FormField
                    control={captureForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Docs Starter" />
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
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} placeholder="Optional details" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={captureForm.control}
                    name="sourcePath"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Source folder</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input {...field} readOnly placeholder="/path/to/folder" />
                            <Button type="button" variant="outline" onClick={pickSourceFolder}>
                              <FolderOpen className="size-4 mr-2" />
                              Browse
                            </Button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={captureSubmitting}>
                      {captureSubmitting ? 'Capturing...' : 'Capture Template'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Button type="button" size="sm" variant="secondary" disabled={!desktopAvailable} onClick={() => void openBuilder(undefined)}>
            <PlusCircle className="size-4 mr-2" />
            Create blank template
          </Button>
        </div>
      }
    >
      {!desktopAvailable ? (
        <div className="rounded-md border border-dashed border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Templates require the desktop shell. Launch via <code>npm run dev:desktop</code> to design, capture, and apply them.
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive mt-2">{error}</p> : null}

      {loading && templates.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
          <Loader2 className="size-4 animate-spin" />
          Loading templates...
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {formattedTemplates.map((template) => (
            <div key={template.id} className="rounded-lg border border-border p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{template.name}</p>
                  <p className="text-xs text-muted-foreground">{template.createdDate}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => void openBuilder(template.id)}>
                    <PenSquare className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3">{template.description || 'No description.'}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="flex items-center gap-1">
                  <FileArchive className="size-3" />
                  {template.fileCount ?? 0} files
                </Badge>
                <Badge variant="outline">{template.folderCount ?? 0} folders</Badge>
              </div>
            </div>
          ))}
          {formattedTemplates.length === 0 && !loading ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground col-span-full">
              No templates yet. Capture an existing folder or create one from scratch to get started.
            </div>
          ) : null}
        </div>
      )}

      <Dialog
        open={builderDialogOpen}
        onOpenChange={(open) => {
          setBuilderDialogOpen(open);
          if (!open) resetBuilderState();
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{builderTemplateId ? 'Edit template' : 'Create template'}</DialogTitle>
            <DialogDescription>Define folders, files, and tokens to scaffold future projects.</DialogDescription>
          </DialogHeader>
          {builderLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading template...
            </div>
          ) : (
            <div className="space-y-4">
              {builderError ? <p className="text-xs text-destructive">{builderError}</p> : null}
              <Form {...builderForm}>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={builderForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Template name" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={builderForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Optional description" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </Form>
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-foreground">Folders</p>
                    <p className="text-xs text-muted-foreground">Relative to the project root.</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={addFolderRow}>
                    Add folder
                  </Button>
                </div>
                <div className="space-y-2">
                  {builderFolders.map((folder) => (
                    <div key={folder.id} className="flex gap-2">
                      <Input
                        value={folder.path}
                        onChange={(event) => updateFolderRow(folder.id, event.target.value)}
                        placeholder="src/docs"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeFolderRow(folder.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {builderFolders.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No folders yet. Add one to create directory structure.</p>
                  ) : null}
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-foreground">Files</p>
                    <p className="text-xs text-muted-foreground">Provide relative paths and starter contents.</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={addFileRow}>
                    Add file
                  </Button>
                </div>
                <div className="space-y-4">
                  {builderFiles.map((file) => (
                    <div key={file.id} className="rounded-md border border-border p-3 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={file.path}
                          onChange={(event) => updateFileRow(file.id, { path: event.target.value })}
                          placeholder="README.md"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeFileRow(file.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <Textarea
                        rows={4}
                        value={file.content}
                        onChange={(event) => updateFileRow(file.id, { content: event.target.value })}
                        placeholder="# Hello template"
                      />
                    </div>
                  ))}
                  {builderFiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Add files to pre-populate content for new projects.</p>
                  ) : null}
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-foreground">Tokens</p>
                    <p className="text-xs text-muted-foreground">
                      Reference tokens inside file contents using Mustache syntax (e.g. {'{{clientName}}'}).
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={addTokenRow}>
                    Add token
                  </Button>
                </div>
                <div className="space-y-2">
                  {builderTokens.map((token) => (
                    <div key={token.id} className="grid gap-2 md:grid-cols-3">
                      <Input
                        value={token.key}
                        onChange={(event) => updateTokenRow(token.id, { key: event.target.value })}
                        placeholder="clientName"
                      />
                      <Input
                        value={token.label}
                        onChange={(event) => updateTokenRow(token.id, { label: event.target.value })}
                        placeholder="Label"
                      />
                      <div className="flex gap-2">
                        <Input
                          value={token.defaultValue}
                          onChange={(event) => updateTokenRow(token.id, { defaultValue: event.target.value })}
                          placeholder="Default value"
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeTokenRow(token.id)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {builderTokens.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Tokens help personalize templates during apply.</p>
                  ) : null}
                </div>
              </section>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button type="button" onClick={handleSaveTemplate} disabled={builderSaving || builderLoading}>
              {builderSaving ? 'Saving...' : 'Save template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

const RefreshIcon = () => (
  <svg className="size-4" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3 10a7 7 0 0 1 12.124-4.95M17 10a7 7 0 0 1-12.124 4.95M3 10H1M17 10h2M4.5 4.5 3 3m13.5 0-1.5 1.5M3 17l1.5-1.5M17 17l-1.5-1.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
