import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MessageSquarePlus, MoreHorizontal, Pencil, Trash2, Send, X, MessageCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { taskUpdatesApi } from '@/api/journal';

import type { TaskUpdate, TaskUpdateEntityType, CreateTaskUpdateRequest } from '@workspace/shared';

interface TaskUpdatesSectionProps {
  entityType: TaskUpdateEntityType;
  entityId: string;
}

function formatUpdateDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function TaskUpdatesSection({ entityType, entityId }: TaskUpdatesSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const queryClient = useQueryClient();
  const queryKey = ['task-updates', entityType, entityId];

  // Fetch updates
  const { data: updatesRes, isLoading } = useQuery({
    queryKey,
    queryFn: () => taskUpdatesApi.listByEntity(entityType, entityId),
    enabled: !!entityId
  });

  const updates = updatesRes?.items ?? [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateTaskUpdateRequest) => taskUpdatesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setNewContent('');
      setIsAdding(false);
    },
    onError: (err) => {
      console.error('Failed to add update:', err);
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      taskUpdatesApi.update(id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingId(null);
      setEditingContent('');
    },
    onError: (err) => {
      console.error('Failed to save update:', err);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => taskUpdatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => {
      console.error('Failed to delete update:', err);
    }
  });

  const handleAdd = useCallback(() => {
    if (!newContent.trim()) return;
    createMutation.mutate({
      entityType,
      entityId,
      content: newContent.trim()
    });
  }, [createMutation, entityType, entityId, newContent]);

  const handleEdit = useCallback((update: TaskUpdate) => {
    setEditingId(update.id);
    setEditingContent(update.content);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId || !editingContent.trim()) return;
    updateMutation.mutate({ id: editingId, content: editingContent.trim() });
  }, [updateMutation, editingId, editingContent]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingContent('');
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground uppercase flex items-center gap-1">
          <MessageCircle className="h-3 w-3" />
          Updates
          {updates.length > 0 && (
            <span className="ml-1 bg-muted px-1.5 py-0.5 rounded-full text-[10px]">
              {updates.length}
            </span>
          )}
        </Label>
        {!isAdding && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 text-xs"
            onClick={() => setIsAdding(true)}
          >
            <MessageSquarePlus className="h-3 w-3" />
            Add
          </Button>
        )}
      </div>

      {/* Add new update form */}
      {isAdding && (
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
          <Textarea
            placeholder="What's the latest on this task?"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="min-h-[60px] resize-none text-sm"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsAdding(false);
                setNewContent('');
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newContent.trim() || createMutation.isPending}
            >
              <Send className="h-4 w-4 mr-1" />
              {createMutation.isPending ? 'Adding...' : 'Add Update'}
            </Button>
          </div>
        </div>
      )}

      {/* Updates list */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Loading updates...</div>
      ) : updates.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          No updates yet. Add one to track your progress.
        </div>
      ) : (
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-3">
            {updates.map((update) => (
              <div
                key={update.id}
                className="relative p-3 bg-muted/30 rounded-lg border border-transparent hover:border-border transition-colors group"
              >
                {editingId === update.id ? (
                  /* Edit mode */
                  <div className="space-y-2">
                    <Textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="min-h-[60px] resize-none text-sm"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={!editingContent.trim() || updateMutation.isPending}
                      >
                        {updateMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <>
                    <p className="text-sm whitespace-pre-wrap pr-8">{update.content}</p>
                    <p
                      className="text-xs text-muted-foreground mt-2"
                      title={formatFullDate(update.createdAt)}
                    >
                      {formatUpdateDate(update.createdAt)}
                      {update.updatedAt !== update.createdAt && ' (edited)'}
                    </p>

                    {/* Actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(update)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(update.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
