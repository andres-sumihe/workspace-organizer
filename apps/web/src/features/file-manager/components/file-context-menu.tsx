import { Edit } from 'lucide-react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu';

interface FileContextMenuProps {
  children: React.ReactNode;
  onRename: () => void;
  disabled?: boolean;
}

export const FileContextMenu = ({ children, onRename, disabled }: FileContextMenuProps) => {
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
        {/* Future context menu items can be added here */}
      </ContextMenuContent>
    </ContextMenu>
  );
};
