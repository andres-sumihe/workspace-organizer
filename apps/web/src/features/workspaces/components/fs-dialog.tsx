import type { FsDialogState, FileFormValues, FolderFormValues } from '../types';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface FsDialogProps {
  state: FsDialogState | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderForm: UseFormReturn<FolderFormValues>;
  fileForm: UseFormReturn<FileFormValues>;
  onCreateFolder: (values: FolderFormValues) => void | Promise<void>;
  onCreateFile: (values: FileFormValues) => void | Promise<void>;
  desktopAvailable: boolean;
  error: string | null;
}

export const FsDialog = ({
  state,
  open,
  onOpenChange,
  folderForm,
  fileForm,
  onCreateFolder,
  onCreateFile,
  desktopAvailable,
  error
}: FsDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {state?.mode === 'folder'
            ? `Create folder in ${state?.projectPath}`
            : state?.mode === 'file'
              ? `Create file in ${state?.projectPath}`
              : 'Filesystem action'}
        </DialogTitle>
        {!desktopAvailable ? <DialogDescription>Desktop shell required for filesystem operations.</DialogDescription> : null}
      </DialogHeader>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {state?.mode === 'folder' ? (
        <Form {...folderForm}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void folderForm.handleSubmit(onCreateFolder)(event);
            }}
          >
            <FormField
              control={folderForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Folder name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="documentation" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={!desktopAvailable}>
                Create folder
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </Form>
      ) : state?.mode === 'file' ? (
        <Form {...fileForm}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void fileForm.handleSubmit(onCreateFile)(event);
            }}
          >
            <FormField
              control={fileForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>File name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="README.md" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={fileForm.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial content</FormLabel>
                  <FormControl>
                    <Textarea rows={6} {...field} placeholder="# Notes" />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={!desktopAvailable}>
                Create file
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </Form>
      ) : null}
    </DialogContent>
  </Dialog>
);
