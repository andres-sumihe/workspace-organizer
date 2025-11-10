import { useCallback, useEffect, useMemo, useState } from 'react';

import { AlertCircle, ChevronRight, FileText, Folder, GitMerge, ListTree, RefreshCw, SplitSquareHorizontal } from 'lucide-react';

import { fetchWorkspaceList } from '@/api/workspaces';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

import type { WorkspaceSummary } from '@workspace/shared';
import { useForm } from 'react-hook-form';

interface MergeFormValues {
  destination: string;
  separator: string;
  includeHeaders: boolean;
  overwrite: boolean;
}

interface SplitFormValues {
  separator: string;
  prefix: string;
  extension: string;
  overwrite: boolean;
  preserveOriginal: boolean;
}

const relativeJoin = (base: string, segment: string) => {
  const normalizedBase = base.replace(/\\/g, '/').replace(/\/$/, '');
  const normalizedSegment = segment.replace(/\\/g, '/').replace(/^\//, '');
  if (!normalizedBase) {
    return normalizedSegment;
  }
  return normalizedSegment ? `${normalizedBase}/${normalizedSegment}` : normalizedBase;
};

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

  useEffect(() => {
    if (activeWorkspace && desktopAvailable) {
      loadDirectory('');
    }
  }, [activeWorkspace?.id, desktopAvailable, loadDirectory]);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to preview file';
      setPreviewError(message);
    }
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

  return (
    <div className="space-y-4">
      {!desktopAvailable ? <DesktopOnlyBanner /> : null}
      <PageShell
        title="Workspace Files"
        description="Inspect workspace folders, preview files, and run merge/split workflows."
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <ListTree className="size-4 text-muted-foreground" />
              <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId} disabled={workspaceLoading}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Workspaces</SelectLabel>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>
                        {ws.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => loadDirectory(currentPath)}
              disabled={directoryLoading || !desktopAvailable}
            >
              <RefreshCw className={directoryLoading ? 'size-4 animate-spin' : 'size-4'} />
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={selectedFiles.size < 2 || !desktopAvailable}
              onClick={openMergeDialog}
              className="flex items-center gap-2"
            >
              <GitMerge className="size-4" />
              Merge selected
            </Button>
          </div>
        }
      >
        {workspaceError ? (
          <div className="text-sm text-destructive">Failed to load workspaces: {workspaceError}</div>
        ) : null}
        {directoryError ? <div className="text-sm text-destructive">Error: {directoryError}</div> : null}
        {operationMessage ? <div className="text-sm text-emerald-600">{operationMessage}</div> : null}
        {operationError ? <div className="text-sm text-destructive">{operationError}</div> : null}

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-lg border border-border">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                {breadcrumbs.map((crumb, index) => (
                  <button
                    key={crumb.path || 'root'}
                    type="button"
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => loadDirectory(crumb.path)}
                    disabled={directoryLoading}
                  >
                    <span>{crumb.label || 'Root'}</span>
                    {index < breadcrumbs.length - 1 ? <ChevronRight className="size-3.5" /> : null}
                  </button>
                ))}
              </div>
            </div>
            <ScrollArea className="h-[480px]">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Size</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Modified</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((entry) => (
                    <tr key={entry.path} className="hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          className="flex items-center gap-2 text-left text-foreground"
                          onClick={() => handleEntryClick(entry)}
                          disabled={directoryLoading}
                        >
                          {entry.type === 'directory' ? <Folder className="size-4" /> : <FileText className="size-4" />}
                          <span>{entry.name}</span>
                        </button>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {entry.size !== null ? `${(entry.size / 1024).toFixed(1)} KB` : '—'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(entry.modifiedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        {entry.type === 'file' ? (
                          <label className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              checked={selectedFiles.has(entry.path)}
                              onCheckedChange={() => toggleSelection(entry)}
                            />
                            Select
                          </label>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Preview</p>
              {preview?.path ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={openSplitDialog}
                  disabled={!desktopAvailable}
                >
                  <SplitSquareHorizontal className="size-4" />
                  Split file
                </Button>
              ) : null}
            </div>
            <div className="mt-3">
              {previewError ? (
                <p className="text-sm text-destructive">{previewError}</p>
              ) : preview ? (
                <div className="space-y-2 text-sm">
                  <p className="font-mono text-xs text-muted-foreground break-all">{preview.path}</p>
                  <div className="rounded-md border border-border bg-muted/40 p-3 h-64 overflow-auto max-w-full w-full">
                    <pre className="whitespace-pre-wrap break-all text-xs text-foreground w-full">{preview.content}</pre>
                  </div>
                  {preview.truncated ? (
                    <p className="text-xs text-muted-foreground">Preview truncated to 512KB.</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a file to see its contents.</p>
              )}
            </div>
          </div>
        </div>
      </PageShell>

      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Merge selected files</DialogTitle>
            <DialogDescription>Combine the selected files into a single text document.</DialogDescription>
          </DialogHeader>
          <Form {...mergeForm}>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void mergeForm.handleSubmit((values) => handleMerge(values))(event);
              }}
            >
              <FormField
                control={mergeForm.control}
                name="destination"
                rules={{ required: true }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination path</FormLabel>
                    <FormControl>
                      <Input placeholder="folder/merged-output.txt" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={mergeForm.control}
                name="separator"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Separator</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex items-center justify-between">
                <FormField
                  control={mergeForm.control}
                  name="includeHeaders"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="m-0">Add filename headers</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={mergeForm.control}
                  name="overwrite"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="m-0">Allow overwrite</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setMergeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex items-center gap-2">
                  <GitMerge className="size-4" />
                  Merge
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={splitDialogOpen} onOpenChange={setSplitDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Split file</DialogTitle>
            <DialogDescription>Break the current file into smaller files by separator.</DialogDescription>
          </DialogHeader>
          <Form {...splitForm}>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void splitForm.handleSubmit((values) => handleSplit(values))(event);
              }}
            >
              <FormField
                control={splitForm.control}
                name="separator"
                rules={{ required: true }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Separator</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={splitForm.control}
                  name="prefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Filename prefix</FormLabel>
                      <FormControl>
                        <Input placeholder="notes-part" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={splitForm.control}
                  name="extension"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Extension</FormLabel>
                      <FormControl>
                        <Input placeholder=".txt" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex items-center justify-between">
                <FormField
                  control={splitForm.control}
                  name="overwrite"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="m-0">Allow overwrite</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={splitForm.control}
                  name="preserveOriginal"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="m-0">Keep original file</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setSplitDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex items-center gap-2">
                  <SplitSquareHorizontal className="size-4" />
                  Split
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
