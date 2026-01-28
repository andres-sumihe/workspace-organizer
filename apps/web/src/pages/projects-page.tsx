import {
  Archive,
  Calendar,
  Check,
  ChevronDown,
  Circle,
  ExternalLink,
  Filter,
  FolderOpen,
  Hash,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import type { PersonalProject, PersonalProjectStatus, WorkspaceSummary, Tag } from '@workspace/shared';

import {
  tagsApi,
  personalProjectsApi,
  type CreatePersonalProjectRequest,
  type UpdatePersonalProjectRequest
} from '@/api/journal';
import { workspacesApi } from '@/api/workspaces';
import { AppPage, AppPageContent } from '@/components/layout/app-page';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

// ============================================================================
// Types & Constants
// ============================================================================

const STATUS_CONFIG: Record<
  PersonalProjectStatus,
  { label: string; icon: typeof Circle; color: string; bgColor: string }
> = {
  active: {
    label: 'Active',
    icon: Circle,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30'
  },
  completed: {
    label: 'Completed',
    icon: Check,
    color: 'text-green-500',
    bgColor: 'bg-green-100 dark:bg-green-900/30'
  },
  on_hold: {
    label: 'On Hold',
    icon: Pause,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30'
  },
  archived: {
    label: 'Archived',
    icon: Archive,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30'
  }
};

// ============================================================================
// Hooks
// ============================================================================

function useProjectsData(workspaceFilter?: string, statusFilter?: PersonalProjectStatus[]) {
  const [projects, setProjects] = useState<PersonalProject[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [projectsRes, workspacesRes, tagsRes] = await Promise.all([
        personalProjectsApi.list({
          workspaceId: workspaceFilter,
          status: statusFilter
        }),
        workspacesApi.list({ page: 1, pageSize: 100 }),
        tagsApi.list()
      ]);
      setProjects(projectsRes.items);
      setWorkspaces(workspacesRes.items);
      setTags(tagsRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { projects, workspaces, tags, isLoading, error, refetch: fetchData, setProjects, setTags };
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const dateObj = new Date(dateStr);
  const day = dateObj.getDate();
  const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
  const year = dateObj.getFullYear();
  return `${day} ${month} ${year}`;
}

function getDaysUntilDue(dueDate?: string): { text: string; urgent: boolean } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, urgent: true };
  if (diff === 0) return { text: 'Due today', urgent: true };
  if (diff === 1) return { text: 'Due tomorrow', urgent: true };
  if (diff <= 7) return { text: `${diff}d left`, urgent: false };
  return { text: `${diff}d left`, urgent: false };
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ProjectRowProps {
  project: PersonalProject;
  workspaces: WorkspaceSummary[];
  onEdit: (project: PersonalProject) => void;
  onDelete: (id: string) => void;
  onViewFiles: (projectId: string) => void;
}

function ProjectRow({ project, workspaces, onEdit, onDelete, onViewFiles }: ProjectRowProps) {
  const statusConfig = STATUS_CONFIG[project.status];
  const StatusIcon = statusConfig.icon;
  const workspace = project.workspaceId ? workspaces.find((w) => w.id === project.workspaceId) : null;
  const dueInfo = getDaysUntilDue(project.dueDate);
  const navigate = useNavigate();

  return (
    <TableRow className="group">
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-medium cursor-pointer text-primary" onClick={() => navigate(`/projects/${project.id}`)}>{project.title}</span>
          {project.description && (
            <span className="text-xs text-muted-foreground line-clamp-1">
              {project.description}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`${statusConfig.bgColor} border-0 gap-1`}>
          <StatusIcon className={`h-3 w-3 ${statusConfig.color}`} />
          {statusConfig.label}
        </Badge>
      </TableCell>
      <TableCell>
        {workspace ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto py-1 px-2 gap-1 text-xs"
            onClick={() => onViewFiles(project.id)}
            title={`Workspace: ${workspace.name}`}
          >
            <FolderOpen className="h-3 w-3" />
            Files
            <ExternalLink className="h-3 w-3 opacity-50" />
          </Button>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5 text-sm">
          {project.businessProposalId && (
            <span className="font-mono text-xs">BP: {project.businessProposalId}</span>
          )}
          {project.changeId && (
            <span className="font-mono text-xs">CR: {project.changeId}</span>
          )}
          {!project.businessProposalId && !project.changeId && (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5 text-sm">
          {project.startDate && (
            <span className="text-xs text-muted-foreground">
              Start: {formatDate(project.startDate)}
            </span>
          )}
          {project.dueDate && (
            <span className={`text-xs ${dueInfo?.urgent ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              Due: {formatDate(project.dueDate)}
              {dueInfo && project.status !== 'completed' && (
                <span className="ml-1">({dueInfo.text})</span>
              )}
            </span>
          )}
          {!project.startDate && !project.dueDate && (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {project.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
                {project.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-[10px] h-5 px-1.5"
                style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined }}
              >
                    #{tag.name.toLowerCase()}
              </Badge>
            ))}
            {project.tags.length > 3 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                +{project.tags.length - 3}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(project)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            {workspace && (
              <DropdownMenuItem onClick={() => onViewFiles(project.id)}>
                <FolderOpen className="h-4 w-4 mr-2" />
                Open Files
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(project.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: PersonalProject;
  workspaces: WorkspaceSummary[];
  tags: Tag[];
  defaultWorkspaceId?: string;
  onSave: (data: CreatePersonalProjectRequest | UpdatePersonalProjectRequest, id?: string) => Promise<void>;
  onCreateTag: (name: string) => Promise<Tag>;
}

function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  workspaces,
  tags,
  defaultWorkspaceId,
  onSave,
  onCreateTag
}: ProjectFormDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<PersonalProjectStatus>('active');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [actualEndDate, setActualEndDate] = useState('');
  const [businessProposalId, setBusinessProposalId] = useState('');
  const [changeId, setChangeId] = useState('');
  const [notes, setNotes] = useState('');
  const [folderPath, setFolderPath] = useState('');
  const [workspaceId, setWorkspaceId] = useState<string | 'none'>('none');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (project) {
        setTitle(project.title);
        setDescription(project.description ?? '');
        setStatus(project.status);
        setStartDate(project.startDate ?? '');
        setDueDate(project.dueDate ?? '');
        setActualEndDate(project.actualEndDate ?? '');
        setBusinessProposalId(project.businessProposalId ?? '');
        setChangeId(project.changeId ?? '');
        setNotes(project.notes ?? '');
        setFolderPath(project.folderPath ?? '');
        setWorkspaceId(project.workspaceId ?? 'none');
        setSelectedTagIds(project.tags.map((t) => t.id));
      } else {
        setTitle('');
        setDescription('');
        setStatus('active');
        setStartDate('');
        setDueDate('');
        setActualEndDate('');
        setBusinessProposalId('');
        setChangeId('');
        setNotes('');
        setFolderPath('');
        setWorkspaceId(defaultWorkspaceId ?? 'none');
        setSelectedTagIds([]);
      }
      setNewTagName('');
      setActiveTab('details');
    }
  }, [open, project, defaultWorkspaceId]);
  useEffect(() => {
    if (newTagName.trim()) {
      setTagPopoverOpen(true);
    } else {
      setTagPopoverOpen(false);
    }
  }, [newTagName]);

  const sanitizeTagName = (value: string) => {
    const lower = value.trim().toLowerCase();
    if (!lower) return '';
    // Replace whitespace with hyphen, allow only a-z0-9, hyphen and underscore
    const replaced = lower.replace(/\s+/g, '-');
    const cleaned = replaced.replace(/[^a-z0-9-_]/g, '');
    const collapsed = cleaned.replace(/-+/g, '-');
    return collapsed.replace(/(^-+|-+$)/g, '');
  };

  const sanitizedNewTag = sanitizeTagName(newTagName);

  const handleBrowsePath = async () => {
    if (!window.api?.selectDirectory) {
      console.error('Desktop bridge unavailable');
      return;
    }
    
    try {
      const result = await window.api.selectDirectory();
      if (!result.canceled && result.path) {
        setFolderPath(result.path);
      }
    } catch (err) {
      console.error('Failed to select directory:', err);
    }
  };

  const filteredTagResults = sanitizedNewTag
    ? tags
        .filter((tag) => tag.name.toLowerCase().includes(sanitizedNewTag) && !selectedTagIds.includes(tag.id))
        .slice(0, 10)
    : [];

  const exactMatchingTag = sanitizedNewTag
    ? tags.find((t) => t.name.toLowerCase() === sanitizedNewTag)
    : undefined;

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      const data: CreatePersonalProjectRequest | UpdatePersonalProjectRequest = {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        actualEndDate: actualEndDate || undefined,
        businessProposalId: businessProposalId.trim() || undefined,
        changeId: changeId.trim() || undefined,
        notes: notes.trim() || undefined,
        folderPath: folderPath.trim() || undefined,
        workspaceId: workspaceId !== 'none' ? workspaceId : undefined,
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined
      };

      await onSave(data, project?.id);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = async () => {
    const name = sanitizeTagName(newTagName);
    if (!name) return;

    const existing = tags.find((t) => t.name.toLowerCase() === name);
    if (existing) {
      if (!selectedTagIds.includes(existing.id)) {
        setSelectedTagIds([...selectedTagIds, existing.id]);
      }
      setNewTagName('');
      setTagPopoverOpen(false);
      return;
    }

    try {
      const newTag = await onCreateTag(name);
      setSelectedTagIds([...selectedTagIds, newTag.id]);
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
    setNewTagName('');
    setTagPopoverOpen(false);
  };

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
        handleAddTag();
      }
    } else if (e.key === 'Escape') {
      setTagPopoverOpen(false);
      setHighlightedIndex(-1);
    }
  };

  useEffect(() => {
    if (highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      setSelectedTagIds(selectedTagIds.filter((id) => id !== tagId));
    } else {
      setSelectedTagIds([...selectedTagIds, tagId]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{project ? 'Edit Project' : 'New Project'}</DialogTitle>
          <DialogDescription>
            {project ? 'Update project details and metadata' : 'Create a new project to track your initiatives'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="metadata">Business IDs</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] mt-4 pr-4">
          <TabsContent value="details" className="space-y-4 mt-0 p-2">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="e.g., Q1 Financial Reports"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the project"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Folder Path */}
              <div className="space-y-2">
                <Label htmlFor="folderPath">Project Folder</Label>
                <div className="flex gap-2">
                  <Input
                    id="folderPath"
                    placeholder="Local directory path (e.g., C:/Projects/MyProject)"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleBrowsePath}
                    title="Browse for folder"
                    disabled={typeof window === 'undefined' || !window.api?.selectDirectory}
                  >
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Optional: Link a specific local folder to this project.
                </p>
              </div>

              {/* Status & Workspace */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as PersonalProjectStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([s, config]) => (
                        <SelectItem key={s} value={s}>
                          <div className="flex items-center gap-2">
                            <config.icon className={`h-4 w-4 ${config.color}`} />
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workspace">Workspace</Label>
                  <Select value={workspaceId} onValueChange={setWorkspaceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Workspace</SelectItem>
                      {workspaces.map((ws) => (
                        <SelectItem key={ws.id} value={ws.id}>
                          {ws.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <DatePicker value={startDate} onChange={setStartDate} placeholder="Pick date" />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <DatePicker value={dueDate} onChange={setDueDate} placeholder="Pick date" />
                </div>
                <div className="space-y-2">
                  <Label>Actual End Date</Label>
                  <DatePicker value={actualEndDate} onChange={setActualEndDate} placeholder="Pick date" />
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                
                {/* Selected Tags */}
                {selectedTagIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 p-2 border rounded-md bg-muted/50">
                    {selectedTagIds.map((tagId) => {
                      const tag = tags.find((t) => t.id === tagId);
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
                <div>
                  <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                    <PopoverAnchor>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Search or add new tag..."
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          onKeyDown={(e) => {
                            // preserve existing Enter behaviour and also handle arrow keys
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag();
                            }
                            handleInputKeyDown(e as unknown as React.KeyboardEvent<HTMLInputElement>);
                          }}
                          className="flex-1"
                        />
                        <Button type="button" variant="outline" size="icon" onClick={handleAddTag}>
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

                        {!exactMatchingTag && sanitizedNewTag && (
                          <div
                            className="px-3 py-2 hover:bg-accent cursor-pointer text-sm border-t"
                            onClick={() => {
                              handleAddTag();
                              setTagPopoverOpen(false);
                            }}
                          >
                            <span className="text-muted-foreground">Create: </span>
                            <Badge variant="secondary">#{sanitizedNewTag}</Badge>
                          </div>
                        )}
                      </PopoverContent>
                    )}
                  </Popover>
                </div>
              </div>
          </TabsContent>

          <TabsContent value="metadata" className="space-y-4 mt-0 p-2">
              {/* Business Proposal ID */}
              <div className="space-y-2">
                <Label htmlFor="bpId">Business Proposal ID</Label>
                <div className="flex gap-2">
                  <Hash className="h-5 w-5 text-muted-foreground mt-2" />
                  <Input
                    id="bpId"
                    placeholder="e.g., BP-2024-001"
                    value={businessProposalId}
                    onChange={(e) => setBusinessProposalId(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Internal reference for business proposal tracking
                </p>
              </div>

              {/* Change ID */}
              <div className="space-y-2">
                <Label htmlFor="changeId">Change Request ID</Label>
                <div className="flex gap-2">
                  <Hash className="h-5 w-5 text-muted-foreground mt-2" />
                  <Input
                    id="changeId"
                    placeholder="e.g., CR-2024-123"
                    value={changeId}
                    onChange={(e) => setChangeId(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Change management system reference
                </p>
              </div>
          </TabsContent>

          <TabsContent value="notes" className="space-y-4 mt-0 p-2">
              <div className="space-y-2">
                <Label htmlFor="notes">Project Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add meeting minutes, ideas, reminders, or any project-related notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Supports plain text. Use this as a scratchpad for the project.
                </p>
              </div>
          </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {project ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface WorkspaceFilterProps {
  workspaces: WorkspaceSummary[];
  selectedWorkspaceId?: string;
  onSelectWorkspace: (workspaceId?: string) => void;
}

function WorkspaceFilter({ workspaces, selectedWorkspaceId, onSelectWorkspace }: WorkspaceFilterProps) {
  const selectedWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FolderOpen className="h-4 w-4" />
          {selectedWorkspace ? selectedWorkspace.name : 'All Workspaces'}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={() => onSelectWorkspace(undefined)}>
          All Workspaces
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => onSelectWorkspace(ws.id)}
            className="gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            {ws.name}
            {ws.id === selectedWorkspaceId && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>
        ))}
        {workspaces.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No workspaces found
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface StatusFilterProps {
  selectedStatuses: PersonalProjectStatus[];
  onSelectStatuses: (statuses: PersonalProjectStatus[]) => void;
}

function StatusFilter({ selectedStatuses, onSelectStatuses }: StatusFilterProps) {
  const toggleStatus = (status: PersonalProjectStatus) => {
    if (selectedStatuses.includes(status)) {
      onSelectStatuses(selectedStatuses.filter((s) => s !== status));
    } else {
      onSelectStatuses([...selectedStatuses, status]);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Status
          {selectedStatuses.length > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5">
              {selectedStatuses.length}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {Object.entries(STATUS_CONFIG).map(([s, config]) => {
          const status = s as PersonalProjectStatus;
          const isSelected = selectedStatuses.includes(status);
          return (
            <DropdownMenuItem
              key={status}
              onClick={() => toggleStatus(status)}
              className="gap-2"
            >
              <config.icon className={`h-4 w-4 ${config.color}`} />
              {config.label}
              {isSelected && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
          );
        })}
        {selectedStatuses.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSelectStatuses([])}>
              Clear filters
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export function ProjectsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get default workspace from URL params
  const defaultWorkspaceId = searchParams.get('workspaceId') ?? undefined;

  // Filters
  const [workspaceFilter, setWorkspaceFilter] = useState<string | undefined>(defaultWorkspaceId);
  const [statusFilter, setStatusFilter] = useState<PersonalProjectStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // UI state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<PersonalProject | undefined>();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Data
  const { projects, workspaces, tags, isLoading, error, refetch, setProjects, setTags } =
    useProjectsData(workspaceFilter, statusFilter.length > 0 ? statusFilter : undefined);

  // Filtered projects by search
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.businessProposalId?.toLowerCase().includes(query) ||
        p.changeId?.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: projects.length,
      active: projects.filter((p) => p.status === 'active').length,
      completed: projects.filter((p) => p.status === 'completed').length,
      onHold: projects.filter((p) => p.status === 'on_hold').length,
      overdue: projects.filter((p) => {
        if (!p.dueDate || p.status === 'completed') return false;
        const due = new Date(p.dueDate);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        return due < now;
      }).length
    };
  }, [projects]);

  // Handlers
  const handleAddProject = useCallback(() => {
    setEditingProject(undefined);
    setFormDialogOpen(true);
  }, []);

  const handleEditProject = useCallback((project: PersonalProject) => {
    setEditingProject(project);
    setFormDialogOpen(true);
  }, []);

  const handleViewFiles = useCallback(
    (projectId: string) => {
      navigate(`/projects/${projectId}?tab=files`);
    },
    [navigate]
  );

  const handleSaveProject = useCallback(
    async (data: CreatePersonalProjectRequest | UpdatePersonalProjectRequest, id?: string) => {
      if (id) {
        // Update existing project
        const response = await personalProjectsApi.update(id, data as UpdatePersonalProjectRequest);
        // Optimistically update local state
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? response.project : p))
        );
      } else {
        // Create new project
        const response = await personalProjectsApi.create(data as CreatePersonalProjectRequest);
        // Optimistically add to local state
        setProjects((prev) => [response.project, ...prev]);
      }
      // Also refetch to ensure consistency
      await refetch();
    },
    [refetch, setProjects]
  );

  const handleDeleteProject = useCallback(async () => {
    if (!deleteConfirmId) return;

    // Optimistic delete
    const projectToDelete = projects.find((p) => p.id === deleteConfirmId);
    setProjects((prev) => prev.filter((p) => p.id !== deleteConfirmId));

    try {
      await personalProjectsApi.delete(deleteConfirmId);
    } catch (err) {
      console.error('Failed to delete project:', err);
      // Rollback
      if (projectToDelete) {
        setProjects((prev) => [...prev, projectToDelete]);
      }
    } finally {
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, projects, setProjects]);

  const handleCreateTag = useCallback(
    async (name: string): Promise<Tag> => {
      const result = await tagsApi.create({ name });
      setTags((prev) => [...prev, result.tag]);
      return result.tag;
    },
    [setTags]
  );

  return (
    <AppPage
      title="Projects"
      description="Manage your initiatives, track deadlines, and link to workspaces"
      actions={
        <Button size="sm" onClick={handleAddProject} className="gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      }
    >
      <AppPageContent>
        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Projects</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Circle className="h-3 w-3 text-blue-500" /> Active
              </CardDescription>
              <CardTitle className="text-2xl text-blue-500">{stats.active}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Check className="h-3 w-3 text-green-500" /> Completed
              </CardDescription>
              <CardTitle className="text-2xl text-green-500">{stats.completed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Pause className="h-3 w-3 text-yellow-500" /> On Hold
              </CardDescription>
              <CardTitle className="text-2xl text-yellow-500">{stats.onHold}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-destructive" /> Overdue
              </CardDescription>
              <CardTitle className="text-2xl text-destructive">{stats.overdue}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <WorkspaceFilter
              workspaces={workspaces}
              selectedWorkspaceId={workspaceFilter}
              onSelectWorkspace={setWorkspaceFilter}
            />
            <StatusFilter selectedStatuses={statusFilter} onSelectStatuses={setStatusFilter} />
          </div>

          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {/* Content */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-12 text-destructive">
            <p>{error}</p>
            <Button variant="outline" onClick={refetch} className="mt-4">
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !error && filteredProjects.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No projects found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchQuery || workspaceFilter || statusFilter.length > 0
                  ? 'Try adjusting your filters or search query'
                  : 'Get started by creating your first project'}
              </p>
              {!searchQuery && !workspaceFilter && statusFilter.length === 0 && (
                <Button onClick={handleAddProject} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Project
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && filteredProjects.length > 0 && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Project</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[150px]">Files</TableHead>
                  <TableHead className="w-[130px]">Business IDs</TableHead>
                  <TableHead className="w-[180px]">Dates</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    workspaces={workspaces}
                    onEdit={handleEditProject}
                    onDelete={setDeleteConfirmId}
                    onViewFiles={handleViewFiles}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </AppPageContent>

      {/* Form Dialog */}
      <ProjectFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        project={editingProject}
        workspaces={workspaces}
        tags={tags}
        defaultWorkspaceId={defaultWorkspaceId}
        onSave={handleSaveProject}
        onCreateTag={handleCreateTag}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This action cannot be undone.
              Work journal entries linked to this project will no longer have a project reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPage>
  );
}
