import { ChevronRight, FileText, Folder } from 'lucide-react';

import type { WorkspaceBreadcrumb, WorkspaceDirectoryEntry } from '@/types/desktop';
import type { CheckedState } from '@radix-ui/react-checkbox';

import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DirectoryBrowserProps {
  breadcrumbs: WorkspaceBreadcrumb[];
  entries: WorkspaceDirectoryEntry[];
  selectedFiles: Set<string>;
  onNavigate: (path: string) => void;
  onEntryClick: (entry: WorkspaceDirectoryEntry) => void;
  onToggleEntrySelection: (entry: WorkspaceDirectoryEntry) => void;
  onToggleAllSelections: (state: CheckedState) => void;
  loading: boolean;
}

export const DirectoryBrowser = ({
  breadcrumbs,
  entries,
  selectedFiles,
  onNavigate,
  onEntryClick,
  onToggleEntrySelection,
  onToggleAllSelections,
  loading
}: DirectoryBrowserProps) => {
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
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="w-6 pl-2 py-2 text-left font-medium text-muted-foreground">
                <Checkbox checked={headerState} onCheckedChange={onToggleAllSelections} />
              </th>
              <th className="pl-2 pr-4 py-2 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Size</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Modified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry) => (
              <tr key={entry.path} className="hover:bg-muted/30">
                <td className="pl-2 py-2">
                  {entry.type === 'file' ? (
                    <Checkbox checked={selectedFiles.has(entry.path)} onCheckedChange={() => onToggleEntrySelection(entry)} />
                  ) : null}
                </td>
                <td className="pl-2 py-2">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-left text-foreground w-full"
                    onClick={() => onEntryClick(entry)}
                    disabled={loading}
                  >
                    {entry.type === 'directory' ? <Folder className="size-4" /> : <FileText className="size-4" />}
                    <span className="truncate">{entry.name}</span>
                  </button>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {entry.size !== null ? `${(entry.size / 1024).toFixed(1)} KB` : '—'}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{new Date(entry.modifiedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
};
