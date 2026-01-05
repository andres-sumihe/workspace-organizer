import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { BatchScriptDetail } from '@workspace/shared';

import { createScript, updateScript, fetchScriptDetail } from '@/api/scripts';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const scriptSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  filePath: z.string().min(1, 'File path is required'),
  description: z.string().optional(),
  type: z.enum(['batch', 'powershell', 'shell', 'other']),
  isActive: z.boolean(),
  content: z.string().min(1, 'Script content is required')
});

type ScriptFormValues = z.infer<typeof scriptSchema>;

interface ScriptDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  scriptId?: string;
  onSuccess?: () => void;
}

export const ScriptDialog = ({ open, onClose, mode, scriptId, onSuccess }: ScriptDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ScriptFormValues>({
    resolver: zodResolver(scriptSchema),
    defaultValues: {
      name: '',
      filePath: '',
      description: '',
      type: 'batch',
      isActive: true,
      content: ''
    }
  });

  // Load script data for edit mode
  useEffect(() => {
    if (open && mode === 'edit' && scriptId) {
      const loadScript = async () => {
        setFetching(true);
        setError(null);
        try {
          const response = await fetchScriptDetail(scriptId);
          const script: BatchScriptDetail = response.script;
          form.reset({
            name: script.name,
            filePath: script.filePath,
            description: script.description || '',
            type: script.type,
            isActive: script.isActive,
            content: script.content
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load script');
        } finally {
          setFetching(false);
        }
      };
      void loadScript();
    } else if (open && mode === 'create') {
      form.reset({
        name: '',
        filePath: '',
        description: '',
        type: 'batch',
        isActive: true,
        content: ''
      });
    }
  }, [open, mode, scriptId, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    setError(null);

    try {
      if (mode === 'create') {
        await createScript({
          name: values.name,
          filePath: values.filePath,
          description: values.description,
          type: values.type,
          isActive: values.isActive,
          content: values.content
        });
      } else if (scriptId) {
        // Only send fields that might have changed
        const updatePayload: Record<string, unknown> = {};
        if (values.name) updatePayload.name = values.name;
        if (values.description !== undefined) updatePayload.description = values.description;
        if (values.type) updatePayload.type = values.type;
        if (values.isActive !== undefined) updatePayload.isActive = values.isActive;
        if (values.content && values.content.trim()) updatePayload.content = values.content;
        
        await updateScript(scriptId, updatePayload);
      }

      onSuccess?.();
      onClose();
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save script');
    } finally {
      setLoading(false);
    }
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (!loading && !fetching) {
      onClose();
      if (!newOpen) {
        form.reset();
        setError(null);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create New Script' : 'Edit Script'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Add a new batch script to your inventory' 
              : 'Update script details and content'}
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  {...form.register('name')}
                  disabled={loading}
                  placeholder="Script name"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={form.watch('type')}
                  onValueChange={(value) => form.setValue('type', value as ScriptFormValues['type'])}
                  disabled={loading}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="batch">Batch</SelectItem>
                    <SelectItem value="powershell">PowerShell</SelectItem>
                    <SelectItem value="shell">Shell</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filePath">File Path *</Label>
              <Input
                id="filePath"
                {...form.register('filePath')}
                disabled={loading || mode === 'edit'}
                placeholder="C:\Scripts\example.bat"
              />
              {mode === 'edit' && (
                <p className="text-xs text-muted-foreground">File path cannot be changed in edit mode</p>
              )}
              {form.formState.errors.filePath && (
                <p className="text-sm text-destructive">{form.formState.errors.filePath.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...form.register('description')}
                disabled={loading}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Script Content *</Label>
              <Textarea
                id="content"
                {...form.register('content')}
                disabled={loading}
                placeholder="@echo off&#10;REM Your script content here..."
                rows={12}
                className="font-mono text-xs"
              />
              {form.formState.errors.content && (
                <p className="text-sm text-destructive">{form.formState.errors.content.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={form.watch('isActive')}
                onCheckedChange={(checked) => form.setValue('isActive', !!checked)}
                disabled={loading}
              />
              <Label htmlFor="isActive" className="text-sm font-normal cursor-pointer">
                Mark as active
              </Label>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={loading || fetching}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || fetching}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  mode === 'create' ? 'Create Script' : 'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
