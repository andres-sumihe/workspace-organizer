import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Send,
  X,
  MessageCircle,
  Reply,
  CornerDownRight,
  User
} from 'lucide-react';

import { useTeamTaskUpdates, useCreateTeamTaskUpdate, useUpdateTeamTaskUpdate, useDeleteTeamTaskUpdate } from '@/features/team-projects';
import { useAuth } from '@/contexts/auth-context';
import { formatRelativeTime, formatTimestampDisplay } from '@/features/journal/utils/journal-parser';

import type { TeamTaskUpdate } from '@workspace/shared';

interface TeamTaskUpdatesSectionProps {
  teamId: string;
  projectId: string;
  taskId: string;
}

function getDisplayName(update: TeamTaskUpdate): string {
  if (update.createdByDisplayName) return update.createdByDisplayName;
  // Extract name from email (before @)
  const atIndex = update.createdByEmail.indexOf('@');
  return atIndex > 0 ? update.createdByEmail.substring(0, atIndex) : update.createdByEmail;
}

export function TeamTaskUpdatesSection({ teamId, projectId, taskId }: TeamTaskUpdatesSectionProps) {
  const { user } = useAuth();
  const currentEmail = user?.email ?? '';

  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const { data: updatesRes, isLoading } = useTeamTaskUpdates(teamId, projectId, taskId);
  const createMutation = useCreateTeamTaskUpdate(teamId, projectId, taskId);
  const updateMutation = useUpdateTeamTaskUpdate(teamId, projectId, taskId);
  const deleteMutation = useDeleteTeamTaskUpdate(teamId, projectId, taskId);

  // Reverse to show newest updates first
  const updates = [...(updatesRes?.items ?? [])].reverse();

  const handleAdd = useCallback(() => {
    if (!newContent.trim()) return;
    createMutation.mutate(
      { content: newContent.trim() },
      {
        onSuccess: () => {
          setNewContent('');
          setIsAdding(false);
        },
      }
    );
  }, [createMutation, newContent]);

  const handleEdit = useCallback((update: TeamTaskUpdate) => {
    setEditingId(update.id);
    setEditingContent(update.content);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId || !editingContent.trim()) return;
    updateMutation.mutate(
      { updateId: editingId, payload: { content: editingContent.trim() } },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditingContent('');
        },
      }
    );
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

  const handleReply = useCallback((parentId: string) => {
    setReplyingToId(parentId);
    setReplyContent('');
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyingToId(null);
    setReplyContent('');
  }, []);

  const handleSubmitReply = useCallback(() => {
    if (!replyingToId || !replyContent.trim()) return;
    createMutation.mutate(
      { parentId: replyingToId, content: replyContent.trim() },
      {
        onSuccess: () => {
          setReplyingToId(null);
          setReplyContent('');
        },
      }
    );
  }, [createMutation, replyingToId, replyContent]);

  const totalUpdatesCount = updates.reduce(
    (acc, u) => acc + 1 + (u.replies?.length ?? 0),
    0
  );

  const isOwner = (email: string) => email === currentEmail;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground uppercase flex items-center gap-1">
          <MessageCircle className="h-3 w-3" />
          Updates
          {totalUpdatesCount > 0 && (
            <span className="ml-1 bg-muted px-1.5 py-0.5 rounded-full text-[10px]">
              {totalUpdatesCount}
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
            className="min-h-15 text-sm"
            rows={3}
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
          No updates yet. Add one to track progress.
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map((update) => (
            <div key={update.id} className="space-y-2">
              {/* Main update */}
              <div className="relative p-3 bg-muted/30 rounded-lg border border-transparent hover:border-border transition-colors group">
                {editingId === update.id ? (
                  /* Edit mode */
                  <div className="space-y-2">
                    <Textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="min-h-15 text-sm"
                      rows={3}
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
                    {/* Author line */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium">{getDisplayName(update)}</span>
                    </div>

                    <p className="text-sm whitespace-pre-wrap pr-8">{update.content}</p>

                    <p
                      className="text-xs text-muted-foreground mt-2"
                      title={formatTimestampDisplay(update.createdAt)}
                    >
                      {formatRelativeTime(update.createdAt)}
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
                        <DropdownMenuItem onClick={() => handleReply(update.id)}>
                          <Reply className="h-4 w-4 mr-2" />
                          Reply
                        </DropdownMenuItem>
                        {isOwner(update.createdByEmail) && (
                          <>
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
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>

              {/* Replies */}
              {update.replies && update.replies.length > 0 && (
                <div className="ml-4 space-y-2 border-l-2 border-muted pl-3">
                  {update.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="relative p-2 bg-muted/20 rounded-md border border-transparent hover:border-border transition-colors group"
                    >
                      {editingId === reply.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="min-h-10 text-sm"
                            rows={2}
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
                        <>
                          <div className="flex items-start gap-1">
                            <CornerDownRight className="h-3 w-3 text-muted-foreground mt-1 shrink-0" />
                            <div className="flex-1 pr-6">
                              <div className="flex items-center gap-1.5 mb-1">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs font-medium">{getDisplayName(reply)}</span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                            </div>
                          </div>
                          <p
                            className="text-xs text-muted-foreground mt-1 ml-4"
                            title={formatTimestampDisplay(reply.createdAt)}
                          >
                            {formatRelativeTime(reply.createdAt)}
                            {reply.updatedAt !== reply.createdAt && ' (edited)'}
                          </p>

                          {/* Reply actions - only owner can edit/delete */}
                          {isOwner(reply.createdByEmail) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(reply)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(reply.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Reply form */}
              {replyingToId === update.id && (
                <div className="ml-4 space-y-2 p-2 bg-muted/30 rounded-lg border-l-2 border-primary">
                  <div className="flex items-start gap-2">
                    <CornerDownRight className="h-4 w-4 text-primary mt-2 shrink-0" />
                    <Textarea
                      placeholder="Write a reply..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      className="min-h-10 text-sm flex-1"
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={handleCancelReply}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmitReply}
                      disabled={!replyContent.trim() || createMutation.isPending}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      {createMutation.isPending ? 'Sending...' : 'Reply'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
