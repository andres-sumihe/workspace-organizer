import { AlertCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { WorkspaceBreadcrumb, WorkspaceDirectoryEntry, WorkspaceFilePreview } from '@/types/desktop';
import type { CheckedState } from '@radix-ui/react-checkbox';
import type { WorkspaceSummary } from '@workspace/shared';

import { fetchWorkspaceList } from '@/api/workspaces';
import { PageShell } from '@/components/layout/page-shell';
import {
  DirectoryBrowser,
  FileManagerToolbar,
  MergeDialog,
  PreviewPanel,
  SplitDialog,
  isLikelyBinary,
  relativeJoin,
  type MergeFormValues,
  type PreviewMode,
  type SplitFormValues
} from '@/features/file-manager';

const DesktopOnlyBanner = () => (
  <div className="flex items-start gap-2 rounded-md border border-dashed border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900">
    <AlertCircle className="mt-0.5 size-4 shrink-0" />
    <p>
      File management actions require the desktop shell. Launch via <code>npm run dev:desktop</code> to enable browsing,
      merge, and split tools.
    </p>
  </div>
);

export const FileManagerPage = () => {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');

  const [entries, setEntries] = useState<WorkspaceDirectoryEntry[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<WorkspaceBreadcrumb[]>([{ label: 'Root', path: '' }]);
  const [currentPath, setCurrentPath] = useState('');
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);

  const [preview, setPreview] = useState<WorkspaceFilePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('text');
  const [editMode, setEditMode] = useState(false);
  const [editBuffer, setEditBuffer] = useState('');
  const [binaryPreview, setBinaryPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const mergeForm = useForm<MergeFormValues>({
    defaultValues: {
      destination: '',
      separator: '\n\n',
      includeHeaders: true,
      overwrite: false
    }
  });

  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const splitForm = useForm<SplitFormValues>({
    defaultValues: {
      separator: '\n\n',
      prefix: '',
      extension: '.txt',
      overwrite: false,
      preserveOriginal: true
    }
  });

  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [desktopAvailable, setDesktopAvailable] = useState(false);

  useEffect(() => {
    setDesktopAvailable(typeof window !== 'undefined' && typeof window.api?.listDirectory === 'function');
  }, []);

  const activeWorkspace = useMemo(
    () => workspaces.find((ws) => ws.id === selectedWorkspaceId),
    [selectedWorkspaceId, workspaces]
  );

  useEffect(() => {
    const load = async () => {
      setWorkspaceLoading(true);
      setWorkspaceError(null);
      try {
        const payload = await fetchWorkspaceList(1, 50);
        setWorkspaces(payload.items);
        if (payload.items.length > 0) {
          setSelectedWorkspaceId((current) => current || payload.items[0].id);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load workspaces';
        setWorkspaceError(message);
      } finally {
        setWorkspaceLoading(false);
      }
    };
    load();
  }, []);

  const loadDirectory = useCallback(
    async (targetPath: string) => {
      if (!desktopAvailable || !activeWorkspace?.rootPath || !window.api?.listDirectory) {
        setDirectoryError('Desktop file bridge unavailable.');
        return;
      }

      setDirectoryLoading(true);
      setDirectoryError(null);
      setOperationMessage(null);
      setOperationError(null);
      setPreview(null);
      setPreviewError(null);

      try {
        const response = await window.api.listDirectory({ rootPath: activeWorkspace.rootPath, relativePath: targetPath });
        if (!response.ok || !response.entries || !response.breadcrumbs) {
          throw new Error(response.error || 'Unable to read directory');
        }
        setEntries(response.entries);
        setBreadcrumbs(response.breadcrumbs);
        setCurrentPath(response.path ?? targetPath ?? '');
        setSelectedFiles(new Set());
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to read directory';
        setDirectoryError(message);
      } finally {
        setDirectoryLoading(false);
      }
    },
    [activeWorkspace?.rootPath, desktopAvailable]
  );

  const handleRefresh = useCallback(() => {
    void loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  useEffect(() => {
    if (activeWorkspace && desktopAvailable) {
      loadDirectory('');
    }
  }, [activeWorkspace, desktopAvailable, loadDirectory]);

  const handleEntryClick = async (entry: WorkspaceDirectoryEntry) => {
    if (entry.type === 'directory') {
      await loadDirectory(entry.path);
      return;
    }

    if (!window.api?.readTextFile || !activeWorkspace?.rootPath) {
      setPreviewError('Desktop bridge unavailable for preview.');
      return;
    }

    setPreviewError(null);
    try {
      const response = await window.api.readTextFile({
        rootPath: activeWorkspace.rootPath,
        relativePath: entry.path,
        maxBytes: 512 * 1024
      });
      if (!response.ok || typeof response.content !== 'string') {
        throw new Error(response.error || 'Unable to load file preview');
      }
      setPreview({
        path: response.path ?? entry.path,
        content: response.content,
        truncated: Boolean(response.truncated),
        size: response.size ?? 0
      });
      setPreviewMode('text');
      setEditMode(false);
      setEditBuffer(response.content);
      setBinaryPreview(isLikelyBinary(response.content));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to preview file';
      setPreviewError(message);
    }
  };

  const handleToggleEditMode = () => {
    setEditMode((mode) => {
      const next = !mode;
      if (next && preview) {
        setEditBuffer(preview.content);
      }
      return next;
    });
  };

  const toggleSelection = (entry: WorkspaceDirectoryEntry) => {
    if (entry.type !== 'file') return;

    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(entry.path)) {
        next.delete(entry.path);
      } else {
        next.add(entry.path);
      }
      return next;
    });
  };

  const handleToggleAllSelections = (checked: CheckedState) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (checked) {
        entries.forEach((entry) => {
          if (entry.type === 'file') next.add(entry.path);
        });
      } else {
        entries.forEach((entry) => {
          if (entry.type === 'file') next.delete(entry.path);
        });
      }
      return next;
    });
  };

  const handleSaveEdit = async () => {
    if (!editMode || !preview || !activeWorkspace?.rootPath || !window.api?.writeTextFile) return;
    setSaving(true);
    try {
      const resp = await window.api.writeTextFile({
        rootPath: activeWorkspace.rootPath,
        relativePath: preview.path,
        content: editBuffer
      });
      if (!resp.ok) {
        throw new Error(resp.error || 'Failed to save file');
      }
      setPreview((prev) => (prev ? { ...prev, content: editBuffer } : prev));
      setEditMode(false);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const openMergeDialog = () => {
    const defaultDestination = relativeJoin(currentPath, `merged-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
    mergeForm.reset({
      destination: defaultDestination,
      separator: '\n\n',
      includeHeaders: true,
      overwrite: false
    });
    setMergeDialogOpen(true);
  };

  const openSplitDialog = () => {
    if (!preview?.path) return;
    const segments = preview.path.split(/[\\/]/);
    const filename = segments[segments.length - 1] ?? 'file';
    const base = filename.replace(/\.[^.]+$/, '');
    splitForm.reset({
      separator: '\n\n',
      prefix: `${base}-part`,
      extension: filename.includes('.') ? `.${filename.split('.').pop()}` : '.txt',
      overwrite: false,
      preserveOriginal: true
    });
    setSplitDialogOpen(true);
  };

  const handleMerge = async (values: MergeFormValues) => {
    if (!activeWorkspace?.rootPath || !window.api?.mergeTextFiles) {
      setOperationError('Desktop bridge unavailable.');
      return;
    }

    const sources = Array.from(selectedFiles);
    if (sources.length < 2) {
      setOperationError('Select at least two files to merge.');
      return;
    }

    try {
      const response = await window.api.mergeTextFiles({
        rootPath: activeWorkspace.rootPath,
        sources,
        destination: values.destination,
        separator: values.separator,
        includeHeaders: values.includeHeaders,
        overwrite: values.overwrite
      });
      if (!response.ok || !response.destination) {
        throw new Error(response.error || 'Merge failed');
      }
      setOperationMessage(`Merged into ${response.destination}`);
      setSelectedFiles(new Set());
      setMergeDialogOpen(false);
      await loadDirectory(currentPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to merge files';
      setOperationError(message);
    }
  };

  const handleSplit = async (values: SplitFormValues) => {
    if (!activeWorkspace?.rootPath || !window.api?.splitTextFile || !preview?.path) {
      setOperationError('Desktop bridge unavailable.');
      return;
    }

    try {
      const response = await window.api.splitTextFile({
        rootPath: activeWorkspace.rootPath,
        source: preview.path,
        separator: values.separator,
        prefix: values.prefix,
        extension: values.extension,
        overwrite: values.overwrite,
        preserveOriginal: values.preserveOriginal
      });
      if (!response.ok || !response.created) {
        throw new Error(response.error || 'Split failed');
      }
      setOperationMessage(`Created ${response.created.length} files`);
      setSplitDialogOpen(false);
      await loadDirectory(currentPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to split file';
      setOperationError(message);
    }
  };

  const canMerge = selectedFiles.size >= 2 && desktopAvailable;
  const refreshDisabled = directoryLoading || !desktopAvailable;

  return (
    <div className="space-y-4">
      {!desktopAvailable ? <DesktopOnlyBanner /> : null}
      <PageShell
        title="Workspace Files"
        description="Inspect workspace folders, preview files, and run merge/split workflows."
        toolbar={
          <FileManagerToolbar
            workspaces={workspaces}
            selectedWorkspaceId={selectedWorkspaceId}
            onWorkspaceChange={setSelectedWorkspaceId}
            workspaceLoading={workspaceLoading}
            onRefresh={handleRefresh}
            refreshDisabled={refreshDisabled}
            isRefreshing={directoryLoading}
            canMerge={canMerge}
            onMerge={openMergeDialog}
          />
        }
      >
        {workspaceError ? (
          <div className="text-sm text-destructive">Failed to load workspaces: {workspaceError}</div>
        ) : null}
        {directoryError ? <div className="text-sm text-destructive">Error: {directoryError}</div> : null}
        {operationMessage ? <div className="text-sm text-emerald-600">{operationMessage}</div> : null}
        {operationError ? <div className="text-sm text-destructive">{operationError}</div> : null}

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <DirectoryBrowser
            breadcrumbs={breadcrumbs}
            entries={entries}
            selectedFiles={selectedFiles}
            onNavigate={(path) => {
              void loadDirectory(path);
            }}
            onEntryClick={(entry) => {
              void handleEntryClick(entry);
            }}
            onToggleEntrySelection={toggleSelection}
            onToggleAllSelections={handleToggleAllSelections}
            loading={directoryLoading}
          />

          <PreviewPanel
            preview={preview}
            previewError={previewError}
            previewMode={previewMode}
            onModeChange={setPreviewMode}
            editMode={editMode}
            onToggleEditMode={handleToggleEditMode}
            editBuffer={editBuffer}
            onEditBufferChange={setEditBuffer}
            onSave={handleSaveEdit}
            saving={saving}
            binaryPreview={binaryPreview}
            desktopAvailable={desktopAvailable}
            onOpenSplitDialog={openSplitDialog}
          />
        </div>
      </PageShell>

      <MergeDialog form={mergeForm} open={mergeDialogOpen} onOpenChange={setMergeDialogOpen} onSubmit={handleMerge} />
      <SplitDialog form={splitForm} open={splitDialogOpen} onOpenChange={setSplitDialogOpen} onSubmit={handleSplit} />
    </div>
  );
};
