import { ChevronRight, FileText, Folder } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { FileContextMenu } from './file-context-menu';

import type { WorkspaceBreadcrumb, WorkspaceDirectoryEntry } from '@/types/desktop';
import type { CheckedState } from '@radix-ui/react-checkbox';

import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';



interface DirectoryBrowserProps {
  breadcrumbs: WorkspaceBreadcrumb[];
  entries: WorkspaceDirectoryEntry[];
  selectedFiles: Set<string>;
  activeFilePath?: string | null;
  onNavigate: (path: string) => void;
  onEntryClick: (entry: WorkspaceDirectoryEntry) => void;
  onToggleEntrySelection: (entry: WorkspaceDirectoryEntry) => void;
  onToggleAllSelections: (state: CheckedState) => void;
  onRenameEntry: (oldEntry: WorkspaceDirectoryEntry, newName: string) => Promise<void>;
  onDeleteEntry: (entry: WorkspaceDirectoryEntry) => void;
  loading: boolean;
}

export const DirectoryBrowser = ({
  breadcrumbs,
  entries,
  selectedFiles,
  activeFilePath,
  onNavigate,
  onEntryClick,
  onToggleEntrySelection,
  onToggleAllSelections,
  onRenameEntry,
  onDeleteEntry,
  loading
}: DirectoryBrowserProps) => {
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="rounded-lg border border-border">
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
                <th className="w-10 pl-2 py-2 text-left font-medium text-muted-foreground">
                  <Checkbox checked={headerState} onCheckedChange={onToggleAllSelections} />
                </th>
                <th className="pl-2 pr-4 py-2 text-left font-medium text-muted-foreground w-[45%]">Name</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground w-[15%]">Size</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground w-[30%]">Modified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((entry) => {
                const isRenaming = renamingPath === entry.path;
                const isActive = entry.type === 'file' && activeFilePath === entry.path;
                return (
                  <tr key={entry.path} className={`hover:bg-muted/30 ${isActive ? 'bg-primary/10' : ''}`}>
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
                        onRename={() => startRename(entry)} 
                        onDelete={() => onDeleteEntry(entry)}
                        hasMultipleSelected={selectedFiles.size > 1}
                        disabled={loading || isRenaming}
                      >
                        <div className="flex items-center gap-2 text-left text-foreground min-w-0">
                          <div className="flex-shrink-0">
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
};
