import { ChevronRight, Download, FileText, Folder } from 'lucide-react';
import { memo, useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';

import { FileContextMenu } from './file-context-menu';

import type { WorkspaceBreadcrumb, WorkspaceDirectoryEntry } from '@/types/desktop';
import type { CheckedState } from '@radix-ui/react-checkbox';

import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface DirectoryBrowserHandle {
  setActiveHighlight: (path: string | null) => void;
}



interface DirectoryBrowserProps {
  breadcrumbs: WorkspaceBreadcrumb[];
  entries: WorkspaceDirectoryEntry[];
  selectedFiles: Set<string>;
  onNavigate: (path: string) => void;
  onEntryClick: (entry: WorkspaceDirectoryEntry) => void;
  onToggleEntrySelection: (entry: WorkspaceDirectoryEntry) => void;
  onToggleAllSelections: (state: CheckedState) => void;
  onRenameEntry: (oldEntry: WorkspaceDirectoryEntry, newName: string) => Promise<void>;
  onDeleteEntry: (entry: WorkspaceDirectoryEntry) => void;
  onCopy: (paths: string[]) => void;
  onCut: (paths: string[]) => void;
  onPaste: () => void;
  onDuplicate: (entry: WorkspaceDirectoryEntry) => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRevealInExplorer: (path: string) => void;
  onOpenInVSCode: (path: string) => void;
  onArchive: (paths: string[]) => void;
  onExtract: (path: string) => void;
  onImportExternalFiles: (paths: string[]) => Promise<void>;
  hasClipboard?: boolean;
  loading: boolean;
}

const DirectoryBrowserComponent = forwardRef<DirectoryBrowserHandle, DirectoryBrowserProps>(({
  breadcrumbs,
  entries,
  selectedFiles,
  onNavigate,
  onEntryClick,
  onToggleEntrySelection,
  onToggleAllSelections,
  onRenameEntry,
  onDeleteEntry,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onNewFile,
  onNewFolder,
  onRevealInExplorer,
  onOpenInVSCode,
  onArchive,
  onExtract,
  onImportExternalFiles,
  hasClipboard,
  loading
}, ref) => {
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableSectionElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  // Imperative method to update highlight without re-rendering
  const setActiveHighlight = useCallback((path: string | null) => {
    if (!tableRef.current) return;
    
    // Remove previous highlight
    const prevActive = tableRef.current.querySelector('tr[data-active="true"]');
    if (prevActive) {
      prevActive.removeAttribute('data-active');
    }
    
    // Add new highlight
    if (path) {
      const newActive = tableRef.current.querySelector(`tr[data-path="${CSS.escape(path)}"]`);
      if (newActive) {
        newActive.setAttribute('data-active', 'true');
      }
    }
  }, []);

  // Expose the setActiveHighlight method via ref
  useImperativeHandle(ref, () => ({
    setActiveHighlight
  }), [setActiveHighlight]);

  const selectableEntries = entries.filter((entry) => entry.type === 'file');
  const selectedCount = selectableEntries.filter((entry) => selectedFiles.has(entry.path)).length;
  const canSelectAll = selectableEntries.length > 0;
  const headerState: CheckedState = canSelectAll
    ? selectedCount === 0
      ? false
      : selectedCount === selectableEntries.length
        ? true
        : 'indeterminate'
    : false;

  const startRename = (entry: WorkspaceDirectoryEntry) => {
    setRenamingPath(entry.path);
    setRenameValue(entry.name);
  };

  const cancelRename = () => {
    setRenamingPath(null);
    setRenameValue('');
  };

  const commitRename = async (entry: WorkspaceDirectoryEntry) => {
    if (!renameValue.trim() || renameValue === entry.name || renaming) {
      cancelRename();
      return;
    }

    setRenaming(true);
    try {
      await onRenameEntry(entry, renameValue.trim());
      cancelRename();
    } catch (_) {
      // Error handled by parent, keep edit mode active
      setRenaming(false);
    }
  };

  useEffect(() => {
    if (renamingPath && inputRef.current) {
      inputRef.current.focus();
      // Select filename without extension
      const dotIndex = renameValue.lastIndexOf('.');
      if (dotIndex > 0) {
        inputRef.current.setSelectionRange(0, dotIndex);
      } else {
        inputRef.current.select();
      }
    }
  }, [renamingPath, renameValue]);

  // ─── Drag & drop from outside ────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    // Only show overlay if external files are being dragged
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // Paths were captured by preload's capture-phase listener
    if (window.api?.getDroppedFilePaths) {
      const paths = window.api.getDroppedFilePaths();
      if (paths.length > 0) {
        await onImportExternalFiles(paths);
      }
    }
  }, [onImportExternalFiles]);

  return (
    <div
      className="relative rounded-lg border border-border"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={(e) => void handleDrop(e)}
    >
      {/* Drop overlay */}
      {isDragOver ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary bg-primary/10">
          <Download className="size-8 text-primary" />
          <span className="text-sm font-medium text-primary">Drop files here to import</span>
        </div>
      ) : null}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <button
              key={crumb.path || 'root'}
              type="button"
              className="flex items-center gap-1 hover:text-foreground"
              onClick={() => onNavigate(crumb.path)}
              disabled={loading}
            >
              <span>{crumb.label || 'Root'}</span>
              {index < breadcrumbs.length - 1 ? <ChevronRight className="size-3.5" /> : null}
            </button>
          ))}
        </div>
      </div>
      <ScrollArea className="h-[480px]">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed divide-y divide-border text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="pl-2 py-2 text-left font-medium text-muted-foreground w-6">
                  <Checkbox checked={headerState} onCheckedChange={onToggleAllSelections} />
                </th>
                <th className="pl-2 pr-4 py-2 text-left font-medium text-muted-foreground w-[65%]">Name</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground w-[15%]">Size</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground w-[30%]">Modified</th>
              </tr>
            </thead>
            <tbody ref={tableRef} className="divide-y divide-border">
              {entries.map((entry) => {
                const isRenaming = renamingPath === entry.path;
                return (
                  <tr 
                    key={entry.path}
                    data-path={entry.type === 'file' ? entry.path : undefined}
                    className="hover:bg-muted/30 transition-colors duration-150 data-[active=true]:bg-primary/10"
                  >
                    <td className="pl-2 py-2">
                      {entry.type === 'file' ? (
                        <Checkbox
                          checked={selectedFiles.has(entry.path)}
                          onCheckedChange={() => onToggleEntrySelection(entry)}
                          disabled={isRenaming}
                        />
                      ) : null}
                    </td>
                    <td className="pl-2 py-2">
                      <FileContextMenu
                        entryPath={entry.path}
                        entryType={entry.type as 'file' | 'directory'}
                        onRename={() => startRename(entry)} 
                        onDelete={() => onDeleteEntry(entry)}
                        onCopy={onCopy}
                        onCut={onCut}
                        onPaste={onPaste}
                        onDuplicate={() => onDuplicate(entry)}
                        onNewFile={onNewFile}
                        onNewFolder={onNewFolder}
                        onRevealInExplorer={onRevealInExplorer}
                        onOpenInVSCode={onOpenInVSCode}
                        onArchive={onArchive}
                        onExtract={onExtract}
                        hasMultipleSelected={selectedFiles.size > 1}
                        hasClipboard={hasClipboard}
                        disabled={loading || isRenaming}
                      >
                        <div className="flex items-center gap-2 text-left text-foreground min-w-0">
                          <div className="shrink-0">
                            {entry.type === 'directory' ? <Folder className="size-4" /> : <FileText className="size-4" />}
                          </div>
                          {isRenaming ? (
                            <input
                              ref={inputRef}
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={() => void commitRename(entry)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  void commitRename(entry);
                                } else if (e.key === 'Escape') {
                                  cancelRename();
                                }
                              }}
                              disabled={renaming}
                              className="flex-1 px-1 py-0.5 text-sm border border-primary rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary min-w-0"
                            />
                          ) : (
                            <button
                              type="button"
                              className="flex-1 text-left truncate min-w-0"
                              onClick={() => onEntryClick(entry)}
                              disabled={loading}
                              title={entry.name}
                            >
                              {entry.name}
                            </button>
                          )}
                        </div>
                      </FileContextMenu>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-right truncate">
                      {entry.size !== null ? `${(entry.size / 1024).toFixed(1)} KB` : '—'}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground truncate" title={new Date(entry.modifiedAt).toLocaleString()}>
                      {new Date(entry.modifiedAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </div>
  );
});

// Memoize to prevent unnecessary re-renders - highlighting is handled imperatively via ref
export const DirectoryBrowser = memo(DirectoryBrowserComponent);