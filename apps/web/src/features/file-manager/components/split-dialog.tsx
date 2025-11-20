import { SplitSquareHorizontal } from 'lucide-react';

import type { SplitFormValues } from '../types';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface SplitDialogProps {
  form: UseFormReturn<SplitFormValues>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: SplitFormValues) => void | Promise<void>;
}

export const SplitDialog = ({ form, open, onOpenChange, onSubmit }: SplitDialogProps) => {
  const sourceMode = form.watch('sourceMode');
  const mode = form.watch('mode');
  
  const isClipboardMode = sourceMode === 'clipboard';
  const isBoundaryMode = mode === 'boundary';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isClipboardMode ? 'Extract from clipboard' : 'Split file'}</DialogTitle>
          <DialogDescription>
            {isClipboardMode
              ? 'Extract files from clipboard content using boundary markers.'
              : 'Break the current file into smaller files by separator.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit((values) => onSubmit(values))(event);
            }}
          >
            {isBoundaryMode && (
              <div className="rounded-md border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <p className="font-medium">Boundary mode active</p>
                <p className="mt-1">Files will be extracted using <code className="text-[10px]">---FILE-BOUNDARY---|filename|index|</code> markers. Original filenames will be preserved.</p>
              </div>
            )}

            {!isBoundaryMode && (
              <FormField
                control={form.control}
                name="separator"
                rules={{ required: !isBoundaryMode }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Separator</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {!isBoundaryMode && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="prefix"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Filename prefix</FormLabel>
                      <FormControl>
                        <Input placeholder="notes-part" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="extension"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Extension</FormLabel>
                      <FormControl>
                        <Input placeholder=".txt" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="flex flex-col gap-3">
              <FormField
                control={form.control}
                name="overwrite"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="m-0">Allow overwrite</FormLabel>
                  </FormItem>
                )}
              />
              {!isClipboardMode && (
                <FormField
                  control={form.control}
                  name="preserveOriginal"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="m-0">Keep original file</FormLabel>
                    </FormItem>
                  )}
                />
              )}
            </div>
            
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex items-center gap-2">
                <SplitSquareHorizontal className="size-4" />
                {isClipboardMode ? 'Extract' : 'Split'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
