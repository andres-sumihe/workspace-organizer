import {
  Clipboard,
  ClipboardCopy,
  Code,
  Copy,
  Edit,
  ExternalLink,
  FilePlus,
  FolderPlus,
  Scissors,
  Trash2
} from 'lucide-react';

import type { ReactNode } from 'react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu';

interface FileContextMenuProps {
  children: ReactNode;
  entryPath: string;
  entryType: 'file' | 'directory';
  onRename: () => void;
  onDelete: () => void;
  onCopy: (paths: string[]) => void;
  onCut: (paths: string[]) => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRevealInExplorer: (path: string) => void;
  onOpenInVSCode: (path: string) => void;
  hasMultipleSelected?: boolean;
  hasClipboard?: boolean;
  disabled?: boolean;
}

export const FileContextMenu = ({
  children,
  entryPath,
  entryType,
  onRename,
  onDelete,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onNewFile,
  onNewFolder,
  onRevealInExplorer,
  onOpenInVSCode,
  hasMultipleSelected,
  hasClipboard,
  disabled
}: FileContextMenuProps) => {
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {/* Clipboard operations */}
        <ContextMenuItem onClick={() => onCopy([entryPath])} className="cursor-pointer">
          <Copy className="mr-2 h-4 w-4" />
          Copy
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCut([entryPath])} className="cursor-pointer">
          <Scissors className="mr-2 h-4 w-4" />
          Cut
        </ContextMenuItem>
        <ContextMenuItem onClick={onPaste} disabled={!hasClipboard} className="cursor-pointer">
          <Clipboard className="mr-2 h-4 w-4" />
          Paste
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Item operations */}
        <ContextMenuItem onClick={onRename} className="cursor-pointer">
          <Edit className="mr-2 h-4 w-4" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={onDuplicate} className="cursor-pointer">
          <ClipboardCopy className="mr-2 h-4 w-4" />
          Duplicate
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Create new */}
        <ContextMenuItem onClick={onNewFile} className="cursor-pointer">
          <FilePlus className="mr-2 h-4 w-4" />
          New File
        </ContextMenuItem>
        <ContextMenuItem onClick={onNewFolder} className="cursor-pointer">
          <FolderPlus className="mr-2 h-4 w-4" />
          New Folder
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* External actions */}
        <ContextMenuItem onClick={() => onRevealInExplorer(entryPath)} className="cursor-pointer">
          <ExternalLink className="mr-2 h-4 w-4" />
          Reveal in Explorer
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onOpenInVSCode(entryPath)} className="cursor-pointer">
          <Code className="mr-2 h-4 w-4" />
          Open in VS Code
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Delete (last, destructive) */}
        <ContextMenuItem
          onClick={onDelete}
          disabled={hasMultipleSelected}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete{entryType === 'directory' ? ' Folder' : ''}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};