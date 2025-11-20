import { Clipboard, GitMerge } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { MergeFormValues, MergeMode } from '../types';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface MergeDialogProps {
  form: UseFormReturn<MergeFormValues>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: MergeFormValues) => void | Promise<void>;
}

export const MergeDialog = ({ form, open, onOpenChange, onSubmit }: MergeDialogProps) => {
  // Initialize mode state from form value
  const formModeValue = form.watch('mode');
  const [mode, setMode] = useState<MergeMode>(formModeValue || 'simple');

  // Sync local state when form value changes or dialog opens
  useEffect(() => {
    if (open && formModeValue) {
      setMode(formModeValue);
    }
  }, [open, formModeValue]);

  const handleModeChange = (value: MergeMode) => {
    setMode(value);
    form.setValue('mode', value);
    
    // Auto-enable clipboard for boundary mode
    if (value === 'boundary') {
      form.setValue('copyToClipboard', true);
      form.setValue('includeHeaders', false);
    }
  };

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
              name="mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Merge mode</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={mode}
                      onValueChange={(value: string) => {
                        handleModeChange(value as MergeMode);
                        field.onChange(value);
                      }}
                      className="flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="simple" id="mode-simple" />
                        <Label htmlFor="mode-simple" className="font-normal cursor-pointer">
                          Simple merge (basic concatenation)
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="boundary" id="mode-boundary" />
                        <Label htmlFor="mode-boundary" className="font-normal cursor-pointer">
                          Boundary mode (for clipboard transfer & GPO bypass)
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormDescription className="text-xs">
                    {mode === 'boundary'
                      ? 'Uses special boundaries to preserve filenames for later extraction. Perfect for copy/paste workflows.'
                      : 'Standard merge with configurable separator.'}
                  </FormDescription>
                </FormItem>
              )}
            />

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
            
            {mode === 'simple' && (
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
            )}
            
            <div className="flex flex-col gap-3">
              {mode === 'simple' && (
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
              )}
              
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
              
              <FormField
                control={form.control}
                name="copyToClipboard"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        disabled={mode === 'boundary'}
                      />
                    </FormControl>
                    <FormLabel className="m-0 flex items-center gap-2">
                      <Clipboard className="size-3.5" />
                      Copy merged content to clipboard
                      {mode === 'boundary' && <span className="text-xs text-muted-foreground">(auto-enabled)</span>}
                    </FormLabel>
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
