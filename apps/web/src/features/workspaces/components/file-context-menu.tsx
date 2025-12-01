import { Edit, Trash2 } from 'lucide-react';

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
  onRename: () => void;
  onDelete: () => void;
  hasMultipleSelected?: boolean;
  disabled?: boolean;
}

export const FileContextMenu = ({ children, onRename, onDelete, hasMultipleSelected, disabled }: FileContextMenuProps) => {
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onRename} className="cursor-pointer">
          <Edit className="mr-2 h-4 w-4" />
          Rename
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem 
          onClick={onDelete} 
          disabled={hasMultipleSelected}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};