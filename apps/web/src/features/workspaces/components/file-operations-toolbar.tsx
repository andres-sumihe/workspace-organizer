import { GitMerge, SplitSquareHorizontal, Trash2 } from 'lucide-react';
import { memo } from 'react';

import { Button } from '@/components/ui/button';

interface FileOperationsToolbarProps {
  selectedCount: number;
  canMerge: boolean;
  onMerge: () => void;
  onExtract: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

const FileOperationsToolbarComponent = ({
  selectedCount,
  canMerge,
  onMerge,
  onExtract,
  onDelete,
  disabled
}: FileOperationsToolbarProps) => (
  <div className="flex items-center gap-2 rounded-md border border-border/40 p-1">
    <Button
      onClick={onMerge}
      disabled={!canMerge || disabled}
      variant="ghost"
      size="sm"
      className="h-8 gap-2 px-3"
    >
      <GitMerge className="size-4" />
      <span>Merge</span>
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
      className="h-8 gap-2 px-3"
    >
      <SplitSquareHorizontal className="size-4" />
      <span>Extract</span>
    </Button>
    <Button
      onClick={onDelete}
      disabled={selectedCount === 0 || disabled}
      variant="ghost"
      size="sm"
      className="h-8 gap-2 px-3 text-destructive hover:text-destructive"
    >
      <Trash2 className="size-4" />
      <span>Delete</span>
      {selectedCount > 0 && (
        <span className="ml-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-xs font-medium">
          {selectedCount}
        </span>
      )}
    </Button>
  </div>
);

export const FileOperationsToolbar = memo(FileOperationsToolbarComponent);
