import { FolderOpen, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import type { WorkspaceFormValues } from '../types';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface WorkspaceToolbarProps {
  loading: boolean;
  onRefresh: () => void;
  createDialogOpen: boolean;
  onCreateDialogChange: (open: boolean) => void;
  creating: boolean;
  canSelectFolder: boolean;
  selectingFolder: boolean;
  onSelectFolder: () => void;
  form: UseFormReturn<WorkspaceFormValues>;
  onSubmit: (values: WorkspaceFormValues) => void | Promise<void>;
}

export const WorkspaceToolbar = ({
  loading,
  onRefresh,
  createDialogOpen,
  onCreateDialogChange,
  form,
  creating,
  canSelectFolder,
  selectingFolder,
  onSelectFolder,
  onSubmit
}: WorkspaceToolbarProps) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleRefresh = () => {
    setIsAnimating(true);
    onRefresh();
    setTimeout(() => setIsAnimating(false), 600);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        className="flex items-center gap-2"
        disabled={loading}
      >
        <RefreshCw className={`size-4 transition-transform duration-500 ${isAnimating ? 'rotate-360' : ''}`} />
        Refresh
      </Button>
      <Dialog open={createDialogOpen} onOpenChange={onCreateDialogChange}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm">
            New Workspace
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>Create a new workspace to be indexed by the system.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit(onSubmit)(event);
              }}
            >
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
                name="rootPath"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Root path</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input {...field} placeholder="/path/to/repo" />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onSelectFolder}
                          disabled={!canSelectFolder || selectingFolder}
                          className="whitespace-nowrap"
                        >
                          <FolderOpen className="size-4 mr-2" />
                          {canSelectFolder ? (selectingFolder ? 'Selecting...' : 'Choose') : 'Desktop only'}
                        </Button>
                      </div>
                    </FormControl>
                    {!canSelectFolder ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Folder picker currently requires the desktop shell; enter the path manually when running in the browser.
                      </p>
                    ) : null}
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
              <DialogFooter className="md:col-span-2 mt-4 flex items-center gap-2">
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </DialogClose>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
