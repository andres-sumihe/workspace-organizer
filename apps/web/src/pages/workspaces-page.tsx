import { useEffect, useState, useCallback } from 'react';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { fetchWorkspaceList } from '@/api/workspaces';
import type { WorkspaceSummary } from '@workspace/shared';
import { Loader2, RefreshCw } from 'lucide-react';
import { createWorkspace } from '@/api/workspaces';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';

export const WorkspacesPage = () => {
  const [items, setItems] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(6);
  const [total, setTotal] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [openNew, setOpenNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newApplication, setNewApplication] = useState('');
  const [newTeam, setNewTeam] = useState('');
  const [newRootPath, setNewRootPath] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const payload = await fetchWorkspaceList(page, pageSize, signal);
      setItems(payload.items);
      setTotal(payload.meta.total);
    } catch (err: unknown) {
      // Ignore abort errors from AbortController (e.g. cleanup or StrictMode double-mount)
      const isAbort = (err as any)?.name === 'AbortError' || (signal && signal.aborted) || /aborted/i.test(String((err as any)?.message ?? ''));
      if (isAbort) {
        // Do not surface aborts as user-facing errors; simply return and let a manual refresh retry.
        console.debug('Workspace load aborted, suppressing error display.');
        return;
      }

      console.error('Failed to load workspaces', err);
      setError((err as Error)?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <PageShell
        title="Workspaces"
        description="Inventory of indexed workspaces and their status."
        toolbar={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              className="flex items-center gap-2"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin size-4" /> : <RefreshCw className="size-4" />}
              Refresh
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">New Workspace</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New workspace</DialogTitle>
                  <DialogDescription>Create a new workspace to be indexed by the system.</DialogDescription>
                </DialogHeader>
                {/* form will be rendered inside the dialog content */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setCreating(true);
                    try {
                      const resp = await createWorkspace({
                        name: newName,
                        application: newApplication,
                        team: newTeam,
                        rootPath: newRootPath,
                        description: newDescription || undefined
                      });

                      const created = (resp as any).workspace;
                      if (created) {
                        // prepend the new workspace to the list and update total
                        setItems((s) => [created as WorkspaceSummary, ...s]);
                        setTotal((t) => (t ?? 0) + 1);
                        // reset form
                        setNewName('');
                        setNewApplication('');
                        setNewTeam('');
                        setNewRootPath('');
                        setNewDescription('');
                        setOpenNew(false);
                      }
                    } catch (err) {
                      console.error('Failed to create workspace', err);
                      setError((err as Error)?.message ?? 'Failed to create workspace');
                    } finally {
                      setCreating(false);
                    }
                  }}
                  className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                  <div>
                    <Label className="mb-1">Name</Label>
                    <Input required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Workspace name" />
                  </div>

                  <div>
                    <Label className="mb-1">Application</Label>
                    <Input required value={newApplication} onChange={(e) => setNewApplication(e.target.value)} placeholder="Application" />
                  </div>

                  <div>
                    <Label className="mb-1">Team</Label>
                    <Input required value={newTeam} onChange={(e) => setNewTeam(e.target.value)} placeholder="Team" />
                  </div>

                  <div className="md:col-span-3">
                    <Label className="mb-1">Root path</Label>
                    <Input required value={newRootPath} onChange={(e) => setNewRootPath(e.target.value)} placeholder="/path/to/repo" />
                  </div>

                  <div className="md:col-span-3">
                    <Label className="mb-1">Description (optional)</Label>
                    <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Short description" />
                  </div>

                  <DialogFooter>
                    <div className="md:col-span-3 flex items-center gap-2">
                      <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create'}</Button>
                      <DialogClose asChild>
                        <Button type="button" variant="ghost">Cancel</Button>
                      </DialogClose>
                    </div>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      >
        {/* Dialog-based creation is used instead of inline form */}
        {/* If we're loading but have existing items, keep rendering them to avoid flicker.
            Show the initial (full) loading state only when there's no data yet. */}
        {loading && items.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="animate-spin size-4" /> Loading workspaces...
          </div>
        ) : error ? (
          <div className="text-destructive text-sm">Error: {error}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((ws) => (
                <div key={ws.id} className="rounded-md border border-border bg-card p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-base font-semibold text-foreground">{ws.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{ws.application} · {ws.team}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-foreground">{ws.projectCount} projects</div>
                      <div className="text-[11px] text-muted-foreground mt-1">Last indexed: {new Date(ws.lastIndexedAt).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {total !== null && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <div>{items.length} of {total} workspaces</div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  Prev
                </Button>
                <div className="text-xs">Page {page}</div>
                <Button size="sm" variant="ghost" onClick={() => setPage((p) => p + 1)} disabled={total !== null && page * pageSize >= total}>
                  Next
                </Button>
              </div>
            </div>
          )}
      </PageShell>
    </div>
  );
};
