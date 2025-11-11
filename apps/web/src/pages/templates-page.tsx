import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { BuilderMeta, CaptureFormValues, EditableFile, EditableFolder, EditableToken } from '@/features/templates';
import type { TemplateManifest, TemplateSummary, TemplateTokenEntry } from '@/types/desktop';

import { PageShell } from '@/components/layout/page-shell';
import { TemplateBuilderDialog, TemplateGrid, TemplatesToolbar, makeId, normalizePathInput } from '@/features/templates';

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
        <TemplatesToolbar
          desktopAvailable={desktopAvailable}
          loading={loading}
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
          onCreateBlank={() => void openBuilder(undefined)}
        />
      }
    >
      {!desktopAvailable ? (
        <div className="rounded-md border border-dashed border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Templates require the desktop shell. Launch via <code>npm run dev:desktop</code> to design, capture, and apply them.
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      <TemplateGrid templates={formattedTemplates} loading={loading} onEdit={openBuilder} onDelete={handleDeleteTemplate} />

      <TemplateBuilderDialog
        open={builderDialogOpen}
        onOpenChange={(open) => {
          setBuilderDialogOpen(open);
          if (!open) resetBuilderState();
        }}
        builderForm={builderForm}
        folders={builderFolders}
        files={builderFiles}
        tokens={builderTokens}
        onAddFolder={addFolderRow}
        onUpdateFolder={updateFolderRow}
        onRemoveFolder={removeFolderRow}
        onAddFile={addFileRow}
        onUpdateFile={updateFileRow}
        onRemoveFile={removeFileRow}
        onAddToken={addTokenRow}
        onUpdateToken={updateTokenRow}
        onRemoveToken={removeTokenRow}
        builderError={builderError}
        builderLoading={builderLoading}
        builderSaving={builderSaving}
        onSave={handleSaveTemplate}
        title={builderTemplateId ? 'Edit template' : 'Create template'}
      />
    </PageShell>
  );
};
