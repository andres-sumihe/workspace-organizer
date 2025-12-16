import type { WorkspaceFormValues } from '../types';
import type { UseFormReturn } from 'react-hook-form';

import { FolderOpen, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface EditWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<WorkspaceFormValues>;
  onSubmit: (values: WorkspaceFormValues) => void | Promise<void>;
  saving: boolean;
}

export const EditWorkspaceDialog = ({ open, onOpenChange, form, onSubmit, saving }: EditWorkspaceDialogProps) => {
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [canSelectFolder, setCanSelectFolder] = useState(false);

  useEffect(() => {
    setCanSelectFolder(typeof window !== 'undefined' && typeof window.api?.selectDirectory === 'function');
  }, []);

  const pickRootFolder = async () => {
    if (!canSelectFolder) return;
    setSelectingFolder(true);
    try {
      const result = await window.api?.selectDirectory?.();
      if (!result || result.canceled || !result.path) return;
      form.setValue('rootPath', result.path, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true
      });
    } finally {
      setSelectingFolder(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit workspace</DialogTitle>
          <DialogDescription>Update workspace metadata.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rootPath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Root path</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input {...field} className="flex-1" />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void pickRootFolder()}
                      disabled={!canSelectFolder || selectingFolder}
                      className="shrink-0 gap-2"
                    >
                      {selectingFolder ? <Loader2 className="size-4 animate-spin" /> : <FolderOpen className="size-4" />}
                      {canSelectFolder ? 'Choose' : 'Desktop only'}
                    </Button>
                  </div>
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
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
