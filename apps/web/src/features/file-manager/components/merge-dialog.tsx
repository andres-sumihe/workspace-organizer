import { GitMerge } from 'lucide-react';

import type { MergeFormValues } from '../types';
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

interface MergeDialogProps {
  form: UseFormReturn<MergeFormValues>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: MergeFormValues) => void | Promise<void>;
}

export const MergeDialog = ({ form, open, onOpenChange, onSubmit }: MergeDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge selected files</DialogTitle>
          <DialogDescription>Combine the selected files into a single text document.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit((values) => onSubmit(values))(event);
            }}
          >
            <FormField
              control={form.control}
              name="destination"
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destination path</FormLabel>
                  <FormControl>
                    <Input placeholder="folder/merged-output.txt" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="separator"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Separator</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="flex items-center justify-between">
              <FormField
                control={form.control}
                name="includeHeaders"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="m-0">Add filename headers</FormLabel>
                  </FormItem>
                )}
              />
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
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex items-center gap-2">
                <GitMerge className="size-4" />
                Merge
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
