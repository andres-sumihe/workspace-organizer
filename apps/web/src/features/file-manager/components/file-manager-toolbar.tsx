import { GitMerge, ListTree, RefreshCw, SplitSquareHorizontal } from 'lucide-react';
import { useState } from 'react';

import type { WorkspaceSummary } from '@workspace/shared';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

interface FileManagerToolbarProps {
  workspaces: WorkspaceSummary[];
  selectedWorkspaceId: string;
  onWorkspaceChange: (workspaceId: string) => void;
  workspaceLoading: boolean;
  onRefresh: () => void;
  refreshDisabled: boolean;
  isRefreshing: boolean;
  canMerge: boolean;
  onMerge: () => void;
  onSplitFromClipboard: () => void;
  desktopAvailable: boolean;
}

export const FileManagerToolbar = ({
  workspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
  workspaceLoading,
  onRefresh,
  refreshDisabled,
  canMerge,
  onMerge,
  onSplitFromClipboard,
  desktopAvailable
}: FileManagerToolbarProps) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleRefresh = () => {
    setIsAnimating(true);
    onRefresh();
    setTimeout(() => setIsAnimating(false), 600);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <ListTree className="size-4 text-muted-foreground" />
        <Select value={selectedWorkspaceId} onValueChange={onWorkspaceChange} disabled={workspaceLoading}>
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
        onClick={handleRefresh}
        disabled={refreshDisabled}
      >
        <RefreshCw className={`size-4 transition-transform duration-500 ${isAnimating ? 'rotate-360' : ''}`} />
        Refresh
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={!canMerge}
        onClick={onMerge}
        className="flex items-center gap-2"
      >
        <GitMerge className="size-4" />
        Merge selected
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!desktopAvailable}
        onClick={onSplitFromClipboard}
        className="flex items-center gap-2"
      >
        <SplitSquareHorizontal className="size-4" />
        Extract from clipboard
      </Button>
    </div>
  );
};
