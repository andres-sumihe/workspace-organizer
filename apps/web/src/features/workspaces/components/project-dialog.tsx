import type { ProjectFormValues } from '../types';
import type { TemplateSummary } from '@/types/desktop';
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<ProjectFormValues>;
  onSubmit: (values: ProjectFormValues) => void | Promise<void>;
  desktopAvailable: boolean;
  availableTemplates: TemplateSummary[];
  templateLoading: boolean;
  templateError: string | null;
  selectedTemplateId: string;
  onTemplateChange: (value: string) => void;
  onPathManualEdit: () => void;
}

export const ProjectDialog = ({
  open,
  onOpenChange,
  form,
  onSubmit,
  desktopAvailable,
  availableTemplates,
  templateLoading,
  templateError,
  selectedTemplateId,
  onTemplateChange,
  onPathManualEdit
}: ProjectDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New project</DialogTitle>
        <DialogDescription>Link a subfolder to manage as a project.</DialogDescription>
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
                  <Input {...field} placeholder="Docs, API, etc." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="relativePath"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Folder path</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="apps/docs"
                    onChange={(event) => {
                      onPathManualEdit();
                      field.onChange(event);
                    }}
                  />
                </FormControl>
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
                  <Textarea {...field} placeholder="Optional details" />
                </FormControl>
              </FormItem>
            )}
          />
          {desktopAvailable ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Template (optional)</p>
              <Select
                value={selectedTemplateId}
                onValueChange={onTemplateChange}
                disabled={templateLoading || availableTemplates.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      availableTemplates.length
                        ? 'Choose template'
                        : templateLoading
                          ? 'Loading templates...'
                          : 'No templates available'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Templates</SelectLabel>
                    {availableTemplates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {templateError ? <p className="text-xs text-destructive">{templateError}</p> : null}
              {!availableTemplates.length && !templateLoading ? (
                <p className="text-xs text-muted-foreground">
                  Capture templates in the Templates tab and assign them to this workspace.
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="mt-4">
            <Button type="submit">Add project</Button>
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
);
