 
import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';

import type { WorkspaceSummary } from '@workspace/shared';

import { fetchWorkspaceList } from '@/api/workspaces';
import { createWorkspace } from '@/api/workspaces';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
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
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';



export const WorkspacesPage = () => {
  const [items, setItems] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(6);
  const [total, setTotal] = useState<number | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const payload = await fetchWorkspaceList(page, pageSize, signal);
      setItems(payload.items);
      setTotal(payload.meta.total);
    } catch (err: unknown) {
      // Ignore abort errors from AbortController (e.g. cleanup or StrictMode double-mount)
      const e = err;
      const name = typeof e === 'object' && e !== null && 'name' in e ? (e as { name?: unknown }).name : undefined;
      let message = '';
      if (typeof e === 'object' && e !== null && 'message' in e) {
        const raw = (e as { message?: unknown }).message;
        if (typeof raw === 'string') message = raw;
      } else if (typeof e === 'string') {
        message = e;
      }
      const isAbort = name === 'AbortError' ? true : signal?.aborted ? true : /aborted/i.test(message);
      if (isAbort) {
        // Do not surface aborts as user-facing errors; simply return and let a manual refresh retry.
        console.debug('Workspace load aborted, suppressing error display.');
        return;
      }

      console.error('Failed to load workspaces', err);
      if (err instanceof Error) setError(err.message); else if (typeof err === 'string') setError(err); else setError('Unknown error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  interface FormValues {
    name: string;
    application: string;
    rootPath: string;
    description?: string;
  }

  const form = useForm<FormValues>({
    defaultValues: {
      name: '',
      application: '',
      rootPath: '',
      description: '',
    },
  });

  // Submission handler extracted so we can trigger it without a native <form> element.
  const handleCreate = async (values: FormValues) => {
    setCreating(true);
    try {
      const resp = await createWorkspace({
        name: values.name,
        application: values.application,
        rootPath: values.rootPath,
        description: values.description ?? undefined,
      });

      const created = (resp as unknown as { workspace?: WorkspaceSummary }).workspace;
      if (created) {
        setItems((s) => [created, ...s]);
        setTotal((t) => (t ?? 0) + 1);
        form.reset();
        setOpenNew(false);
      }
    } catch (err) {
      console.error('Failed to create workspace', err);
      if (err instanceof Error) setError(err.message); else if (typeof err === 'string') setError(err); else setError('Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

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
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm">New Workspace</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New workspace</DialogTitle>
                  <DialogDescription>Create a new workspace to be indexed by the system.</DialogDescription>
                </DialogHeader>
                {/* form will be rendered inside the dialog content using react-hook-form + shadcn Form */}
                <Form {...form}>
                  <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Workspace name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="application"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Application</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Application" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Team field removed per schema — not persisted server-side */}

                    <FormField
                      control={form.control}
                      name="rootPath"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Root path</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="/path/to/repo" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Description (optional)</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Short description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    

                  </div>
                  <DialogFooter className="mt-4">
                    <div className="flex items-center gap-2">
                      <Button type="button" onClick={form.handleSubmit(handleCreate)} disabled={creating}>{creating ? 'Creating...' : 'Create'}</Button>
                      <DialogClose asChild>
                        <Button type="button" variant="ghost">Cancel</Button>
                      </DialogClose>
                    </div>
                  </DialogFooter>
                </Form>
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
                      <div className="text-xs text-muted-foreground mt-1">{ws.application}</div>
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
