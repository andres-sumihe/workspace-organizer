import { FolderOpen, Loader2, PlusCircle } from 'lucide-react';

import type { CaptureFormValues } from '../types';
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

interface TemplatesToolbarProps {
  desktopAvailable: boolean;
  loading: boolean;
  onRefresh: () => void;
  captureDialogOpen: boolean;
  onCaptureDialogChange: (open: boolean) => void;
  captureForm: UseFormReturn<CaptureFormValues>;
  captureSubmitting: boolean;
  onCaptureSubmit: (values: CaptureFormValues) => void | Promise<void>;
  onSelectSource: () => void;
  onCreateBlank: () => void;
}

const RefreshIcon = () => (
  <svg className="size-4" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3 10a7 7 0 0 1 12.124-4.95M17 10a7 7 0 0 1-12.124 4.95M3 10H1M17 10h2M4.5 4.5 3 3m13.5 0-1.5 1.5M3 17l1.5-1.5M17 17l-1.5-1.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const TemplatesToolbar = ({
  desktopAvailable,
  loading,
  onRefresh,
  captureDialogOpen,
  onCaptureDialogChange,
  captureForm,
  captureSubmitting,
  onCaptureSubmit,
  onSelectSource,
  onCreateBlank
}: TemplatesToolbarProps) => (
  <div className="flex flex-wrap items-center gap-3">
    <Button type="button" size="sm" variant="outline" onClick={onRefresh} disabled={loading || !desktopAvailable}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshIcon />}
      Refresh
    </Button>
    <Dialog open={captureDialogOpen} onOpenChange={onCaptureDialogChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="secondary" disabled={!desktopAvailable}>
          <FolderOpen className="size-4 mr-2" />
          Capture existing folder
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Capture template</DialogTitle>
          <DialogDescription>Select an existing folder to turn into a reusable template.</DialogDescription>
        </DialogHeader>
        <Form {...captureForm}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void captureForm.handleSubmit(onCaptureSubmit)(event);
            }}
          >
            <FormField
              control={captureForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Template name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={captureForm.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Optional description" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={captureForm.control}
              name="sourcePath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source folder</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input {...field} placeholder="/path/to/project" />
                      <Button type="button" variant="outline" onClick={onSelectSource} disabled={!desktopAvailable}>
                        Choose
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={captureSubmitting}>
                {captureSubmitting ? 'Capturing...' : 'Capture Template'}
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
    <Button type="button" size="sm" variant="secondary" disabled={!desktopAvailable} onClick={onCreateBlank}>
      <PlusCircle className="size-4 mr-2" />
      Create blank template
    </Button>
  </div>
);
