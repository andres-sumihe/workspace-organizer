import { Clipboard, FilePlus, FolderPlus, Package, RefreshCw, SplitSquareHorizontal, Trash2 } from 'lucide-react';
import { memo } from 'react';

import { Button } from '@/components/ui/button';

interface FileOperationsToolbarProps {
  selectedCount: number;
  onTransfer: () => void;
  onExtract: () => void;
  onDelete: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onPaste: () => void;
  onRefresh: () => void;
  hasClipboard?: boolean;
  disabled?: boolean;
}

const FileOperationsToolbarComponent = ({
  selectedCount,
  onTransfer,
  onExtract,
  onDelete,
  onNewFile,
  onNewFolder,
  onPaste,
  onRefresh,
  hasClipboard,
  disabled
}: FileOperationsToolbarProps) => (
  <div className="flex items-center gap-1 rounded-md border border-border/40 p-1">
    {/* Create actions */}
    <Button
      onClick={onNewFile}
      disabled={disabled}
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 px-2.5"
      title="Create new file (Ctrl+Shift+N)"
    >
      <FilePlus className="size-4" />
      <span className="hidden sm:inline">File</span>
    </Button>
    <Button
      onClick={onNewFolder}
      disabled={disabled}
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 px-2.5"
      title="Create new folder"
    >
      <FolderPlus className="size-4" />
      <span className="hidden sm:inline">Folder</span>
    </Button>

    {/* Separator */}
    <div className="mx-0.5 h-5 w-px bg-border/60" />

    {/* Paste */}
    <Button
      onClick={onPaste}
      disabled={disabled || !hasClipboard}
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 px-2.5"
      title="Paste (Ctrl+V)"
    >
      <Clipboard className="size-4" />
      <span className="hidden sm:inline">Paste</span>
    </Button>

    {/* Separator */}
    <div className="mx-0.5 h-5 w-px bg-border/60" />

    {/* Transfer & Extract */}
    <Button
      onClick={onTransfer}
      disabled={selectedCount < 1 || disabled}
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 px-2.5"
      title="Pack selected file(s) for transfer via clipboard"
    >
      <Package className="size-4" />
      <span className="hidden sm:inline">Transfer</span>
      {selectedCount > 0 && (
        <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
          {selectedCount}
        </span>
      )}
    </Button>
    <Button
      onClick={onExtract}
      disabled={disabled}
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 px-2.5"
    >
      <SplitSquareHorizontal className="size-4" />
      <span className="hidden sm:inline">Extract</span>
    </Button>

    {/* Separator */}
    <div className="mx-0.5 h-5 w-px bg-border/60" />

    {/* Delete */}
    <Button
      onClick={onDelete}
      disabled={selectedCount === 0 || disabled}
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 px-2.5 text-destructive hover:text-destructive"
    >
      <Trash2 className="size-4" />
      <span className="hidden sm:inline">Delete</span>
      {selectedCount > 0 && (
        <span className="ml-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-xs font-medium">
          {selectedCount}
        </span>
      )}
    </Button>

    {/* Refresh */}
    <Button
      onClick={onRefresh}
      disabled={disabled}
      variant="ghost"
      size="sm"
      className="h-8 px-2"
      title="Refresh directory"
    >
      <RefreshCw className="size-4" />
    </Button>
  </div>
);

export const FileOperationsToolbar = memo(FileOperationsToolbarComponent);
