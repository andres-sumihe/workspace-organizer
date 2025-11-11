import { GitMerge, ListTree, RefreshCw } from 'lucide-react';

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
}

export const FileManagerToolbar = ({
  workspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
  workspaceLoading,
  onRefresh,
  refreshDisabled,
  isRefreshing,
  canMerge,
  onMerge
}: FileManagerToolbarProps) => {
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
        onClick={onRefresh}
        disabled={refreshDisabled}
      >
        <RefreshCw className={isRefreshing ? 'size-4 animate-spin' : 'size-4'} />
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
    </div>
  );
};
