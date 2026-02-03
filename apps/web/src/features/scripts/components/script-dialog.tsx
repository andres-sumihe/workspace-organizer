import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { BatchScriptDetail, ScriptTag } from '@workspace/shared';

import { createScript, updateScript, fetchScriptDetail, fetchTags, createTag } from '@/api/scripts';
import { Badge } from '@/components/ui/badge';
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
  Popover,
  PopoverAnchor,
  PopoverContent
} from '@/components/ui/popover';
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
  const [availableTags, setAvailableTags] = useState<ScriptTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Helper to sanitize tag name
  const sanitizeTagName = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
  const sanitizedNewTag = sanitizeTagName(newTagName);

  const form = useForm<ScriptFormValues>({
    resolver: zodResolver(scriptSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'batch',
      isActive: true,
      content: ''
    }
  });

  // Load available tags
  useEffect(() => {
    if (open) {
      void fetchTags().then(res => setAvailableTags(res.tags || []));
    }
  }, [open]);

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
            description: script.description || '',
            type: script.type,
            isActive: script.isActive,
            content: script.content
          });
          setSelectedTagIds(script.tags?.map(t => t.id) || []);
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
        description: '',
        type: 'batch',
        isActive: true,
        content: ''
      });
      setSelectedTagIds([]);
    }
  }, [open, mode, scriptId, form]);

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      setSelectedTagIds(selectedTagIds.filter(id => id !== tagId));
    } else {
      setSelectedTagIds([...selectedTagIds, tagId]);
    }
  };

  // Filter tags based on input
  const filteredTagResults = sanitizedNewTag
    ? availableTags
        .filter((tag) => tag.name.toLowerCase().includes(sanitizedNewTag) && !selectedTagIds.includes(tag.id))
        .slice(0, 10)
    : [];

  const exactMatchingTag = sanitizedNewTag
    ? availableTags.find((t) => t.name.toLowerCase() === sanitizedNewTag)
    : undefined;

  // Handle adding/creating a tag
  const handleAddTag = async () => {
    const name = sanitizeTagName(newTagName);
    if (!name) return;

    const existing = availableTags.find((t) => t.name.toLowerCase() === name);
    if (existing) {
      if (!selectedTagIds.includes(existing.id)) {
        setSelectedTagIds([...selectedTagIds, existing.id]);
      }
      setNewTagName('');
      setTagPopoverOpen(false);
      return;
    }

    try {
      const result = await createTag(name);
      setAvailableTags([...availableTags, result.tag]);
      setSelectedTagIds([...selectedTagIds, result.tag.id]);
    } catch (err) {
      console.error('Failed to create tag:', err);
    }
    setNewTagName('');
    setTagPopoverOpen(false);
  };

  // Handle keyboard navigation in tag popover
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!tagPopoverOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, filteredTagResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredTagResults.length) {
        const tag = filteredTagResults[highlightedIndex];
        toggleTag(tag.id);
        setNewTagName('');
        setTagPopoverOpen(false);
        setHighlightedIndex(-1);
      } else {
        void handleAddTag();
      }
    } else if (e.key === 'Escape') {
      setTagPopoverOpen(false);
      setHighlightedIndex(-1);
    }
  };

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleSubmit = form.handleSubmit(async (values) => {
    setLoading(true);
    setError(null);

    try {
      if (mode === 'create') {
        await createScript({
          name: values.name,
          description: values.description,
          type: values.type,
          isActive: values.isActive,
          content: values.content,
          tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined
        });
      } else if (scriptId) {
        // Only send fields that might have changed
        const updatePayload: Record<string, unknown> = {};
        if (values.name) updatePayload.name = values.name;
        if (values.description !== undefined) updatePayload.description = values.description;
        if (values.type) updatePayload.type = values.type;
        if (values.isActive !== undefined) updatePayload.isActive = values.isActive;
        if (values.content && values.content.trim()) updatePayload.content = values.content;
        updatePayload.tagIds = selectedTagIds;
        
        await updateScript(scriptId, updatePayload);
      }

      onSuccess?.();
      onClose();
      form.reset();
      setSelectedTagIds([]);
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

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags</Label>
              
              {/* Selected Tags Display */}
              {selectedTagIds.length > 0 && (
                <div className="flex flex-wrap gap-1 p-2 border rounded-md bg-muted/50">
                  {selectedTagIds.map((tagId) => {
                    const tag = availableTags.find((t) => t.id === tagId);
                    if (!tag) return null;
                    return (
                      <Badge
                        key={tag.id}
                        variant="default"
                        className="cursor-pointer gap-1"
                        style={tag.color ? { backgroundColor: tag.color } : undefined}
                        onClick={() => toggleTag(tag.id)}
                      >
                        #{tag.name}
                        <X className="h-3 w-3" />
                      </Badge>
                    );
                  })}
                </div>
              )}
              
              {/* Tag Input with Dropdown */}
              <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                <PopoverAnchor>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search or add new tag..."
                      value={newTagName}
                      onChange={(e) => {
                        setNewTagName(e.target.value);
                        setTagPopoverOpen(!!e.target.value.trim());
                        setHighlightedIndex(-1);
                      }}
                      onKeyDown={handleInputKeyDown}
                      disabled={loading}
                      className="flex-1"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      onClick={() => void handleAddTag()}
                      disabled={loading || !newTagName.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </PopoverAnchor>

                {newTagName.trim() && (
                  <PopoverContent
                    align="start"
                    sideOffset={6}
                    className="w-80 p-1 max-h-48 overflow-auto"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    {filteredTagResults.length > 0 ? (
                      filteredTagResults.map((tag, idx) => (
                        <div
                          key={tag.id}
                          ref={(el) => { optionRefs.current[idx] = el; }}
                          role="option"
                          aria-selected={highlightedIndex === idx}
                          className={`px-3 py-2 cursor-pointer text-sm ${highlightedIndex === idx ? 'bg-accent' : 'hover:bg-accent'}`}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          onMouseLeave={() => setHighlightedIndex(-1)}
                          onClick={() => {
                            toggleTag(tag.id);
                            setNewTagName('');
                            setTagPopoverOpen(false);
                            setHighlightedIndex(-1);
                          }}
                        >
                          <Badge variant="secondary" style={tag.color ? { backgroundColor: `${tag.color}20` } : undefined}>
                            #{tag.name.toLowerCase()}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {exactMatchingTag
                          ? 'Tag already selected or no additional matches.'
                          : 'No matching tags. Press Enter to create.'}
                      </div>
                    )}
                  </PopoverContent>
                )}
              </Popover>
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
