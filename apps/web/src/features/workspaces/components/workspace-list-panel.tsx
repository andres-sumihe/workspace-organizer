import { Loader2 } from 'lucide-react';

import type { WorkspaceSummary } from '@workspace/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface WorkspaceListPanelProps {
  items: WorkspaceSummary[];
  loading: boolean;
  selectedWorkspaceId: string | null;
  onSelect: (workspaceId: string) => void;
  getTemplateCount: (workspaceId: string, fallback: number) => number;
  getWorkspaceStatus: (workspaceId: string, fallback: WorkspaceSummary['status']) => WorkspaceSummary['status'];
  page: number;
  pageSize: number;
  total: number | null;
  onPageChange: (page: number) => void;
}

export const WorkspaceListPanel = ({
  items,
  loading,
  selectedWorkspaceId,
  onSelect,
  getTemplateCount,
  getWorkspaceStatus,
  page,
  pageSize,
  total,
  onPageChange
}: WorkspaceListPanelProps) => {
  const handlePrev = () => {
    onPageChange(Math.max(1, page - 1));
  };

  const handleNext = () => {
    if (total !== null && page * pageSize >= total) return;
    onPageChange(page + 1);
  };

  return (
    <div className="space-y-4">
      {loading && items.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading workspaces...
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((ws) => {
            const templateCount = getTemplateCount(ws.id, ws.templateCount);
            const status = getWorkspaceStatus(ws.id, ws.status);
            const isActive = selectedWorkspaceId === ws.id;
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => onSelect(ws.id)}
                className={`rounded-md border p-4 text-left transition ${
                  isActive ? 'border-primary shadow-sm' : 'border-border hover:border-muted-foreground'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-base font-semibold text-foreground">{ws.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground break-all">{ws.rootPath}</p>
                  </div>
                  <Badge variant={status === 'healthy' ? 'default' : status === 'degraded' ? 'secondary' : 'outline'}>
                    {status}
                  </Badge>
                </div>
                <Separator className="my-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <div>
                    Projects <span className="ml-1 font-semibold text-foreground">{ws.projectCount}</span>
                  </div>
                  <div>
                    Templates <span className="ml-1 font-semibold text-foreground">{templateCount}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {total !== null ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            {items.length} of {total} workspaces
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handlePrev} disabled={page <= 1}>
              Prev
            </Button>
            <div className="text-xs">Page {page}</div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleNext}
              disabled={total !== null && page * pageSize >= total}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
