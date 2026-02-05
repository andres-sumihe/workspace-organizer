import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  Circle,
  Clock,
  Copy,
  Filter,
  FolderOpen,
  Loader2,
  MoveRight,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-client';

import type { WorkLogStatus, WorkLogPriority, PersonalProject, TaskUpdateFlag } from '@workspace/shared';

import {
  tagsApi,
  workLogsApi,
  type Tag,
  type WorkLogEntry,
  type CreateWorkLogRequest,
  type UpdateWorkLogRequest
} from '@/api/journal';
import {
  useWorkLogsList
} from '@/hooks/use-work-logs';
import { useTagsList } from '@/hooks/use-tags';
import { usePersonalProjectsList } from '@/hooks/use-personal-projects';
import { TaskFlagsSection, TaskUpdatesSection, TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '@/components/journal';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  formatDate,
  formatDateDisplay,
  formatTimestampDisplay,
  getWeekRangeLabel,
  getWeekStart,
  getTodayDate,
  getYesterdayDate,
  parseContentForSuggestions,
  formatFullDate
} from '@/utils/journal-parser';

// ============================================================================
// Types & Constants
// ============================================================================

// Use shared config but keep local aliases for compatibility
const STATUS_CONFIG = TASK_STATUS_CONFIG;
const PRIORITY_CONFIG = TASK_PRIORITY_CONFIG;

// Kanban columns in order
const KANBAN_COLUMNS: WorkLogStatus[] = ['todo', 'in_progress', 'done'];

// ============================================================================
// Hooks
// ============================================================================

// Internal hook replaced - using TanStack Query hooks directly in component

// ============================================================================
// Sub-Components
// ============================================================================

interface KanbanCardProps {
  entry: WorkLogEntry;
  index: number;
  isSelected: boolean;
  onSelect: (entry: WorkLogEntry) => void;
}

function KanbanCard({ entry, index, isSelected, onSelect }: KanbanCardProps) {
  const { ref, isDragging } = useSortable({
    id: entry.id,
    index,
    type: 'item',
    accept: 'item',
    group: entry.status
  });

  return (
    <div
      ref={ref}
      onClick={() => onSelect(entry)}
      className={`
        relative p-3 rounded-[3px] cursor-pointer transition-all duration-100 group
        shadow-[0_1px_1px_rgba(9,30,66,0.25),0_0_1px_rgba(9,30,66,0.31)]
        dark:shadow-[0_1px_1px_rgba(0,0,0,0.5),0_0_1px_rgba(0,0,0,0.5)]
        before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.75 ${STATUS_CONFIG[entry.status].accent}
        ${isSelected 
          ? 'bg-[#E9F2FF] dark:bg-[#1D3A5D] shadow-md z-10 hover:bg-[#D6E4FF] dark:hover:bg-[#0F2847]' 
          : 'bg-white dark:bg-[#2C333F] hover:bg-[#F4F5F7] dark:hover:bg-[#353D4A]'}
        ${isDragging ? 'opacity-70 shadow-2xl scale-[1.02] rotate-1 z-50' : ''}
      `}
    >
      {/* Drag Handle + Content */}
      <div className="flex items-start gap-2 ml-1">
        <p className={`text-sm leading-snug flex-1 font-medium ${entry.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground/90'}`}>
          {entry.content}
        </p>
      </div>

      {/* Metadata Row */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 ml-1">
        {entry.priority && (
          <Badge
            variant={PRIORITY_CONFIG[entry.priority].variant}
            className="text-[10px] h-4 px-1 font-bold rounded-[2px] uppercase tracking-tighter"
          >
            {PRIORITY_CONFIG[entry.priority].label}
          </Badge>
        )}
        {entry.dueDate && (
          <Badge variant="outline" className={`text-[10px] h-4 px-1 gap-1 border-none bg-zinc-200/80 dark:bg-zinc-800 text-muted-foreground rounded-[2px]`}>
            <Calendar className="h-3 w-3" />
            {formatDateDisplay(entry.dueDate)}
          </Badge>
        )}
        {entry.project && (
          <Badge variant="secondary" className={`text-[10px] h-4 px-1 gap-1 border-none bg-zinc-200/80 dark:bg-zinc-800 text-muted-foreground rounded-[2px]`}>
            <FolderOpen className="h-3 w-3" />
            {entry.project.title}
          </Badge>
        )}
      </div>

      {/* Tags */}
      {entry.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1 ml-1 opacity-80 group-hover:opacity-100">
          {entry.tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="text-[10px] h-4 px-1 bg-zinc-200/80 dark:bg-zinc-800 border-none text-muted-foreground rounded-[2px]"
              style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined }}
            >
              #{tag.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface KanbanColumnProps {
  status: WorkLogStatus;
  index: number;
  entries: WorkLogEntry[];
  selectedEntry?: WorkLogEntry;
  onSelectEntry: (entry: WorkLogEntry) => void;
}

function KanbanColumn({ status, index, entries, selectedEntry, onSelectEntry }: KanbanColumnProps) {
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;
  const columnEntries = entries.filter((e) => e.status === status);

  const { ref } = useSortable({
    id: status,
    index,
    type: 'column',
    accept: ['item', 'column'],
    collisionPriority: 0 // Low priority so items are matched first
  });

  return (
    <div
      ref={ref}
      className={`flex flex-col rounded-[3px] ${config.bgColor} min-w-[280px] max-w-[340px] flex-1 h-full shadow-sm`}
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 px-3 py-4 select-none">
        <StatusIcon className={`h-4 w-4 ${config.color}`} />
        <span className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground/80">{config.label}</span>
        <Badge className="text-[11px] font-bold text-muted-foreground bg-zinc-200/50 dark:bg-white/5 px-2 py-0.5 rounded-[2px] ml-auto">
          {columnEntries.length}
        </Badge>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 px-1.5 py-1">
        <div className="space-y-2 min-h-[100px] mb-4">
          {
            columnEntries.map((entry, idx) => (
              <KanbanCard
                key={entry.id}
                entry={entry}
                index={idx}
                isSelected={selectedEntry?.id === entry.id}
                onSelect={onSelectEntry}
              />))
          }
        </div>
      </ScrollArea>
    </div>
  );
}

interface TaskDetailModalProps {
  entry: WorkLogEntry | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: Tag[];
  projects: PersonalProject[];
  onEdit: (entry: WorkLogEntry) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: WorkLogStatus) => void;
  onFlagsChange: (id: string, flags: TaskUpdateFlag[]) => void;
}

function TaskDetailModal({ 
  entry,
  open,
  onOpenChange,
  tags: _tags, 
  projects: _projects,
  onEdit, 
  onDelete,
  onStatusChange,
  onFlagsChange 
}: TaskDetailModalProps) {
  // _tags and _projects reserved for future use (e.g., inline tag/project editing)
  void _tags;
  void _projects;

  if (!entry) return null;

  const statusConfig = STATUS_CONFIG[entry.status];
  const StatusIcon = statusConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Task Details</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            View and manage task details, status, and updates
          </DialogDescription>
        </DialogHeader>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Main Info */}
            <div className="space-y-6">
              {/* Status */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase">Status</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
                      {statusConfig.label}
                      <ChevronDown className="h-4 w-4 ml-auto" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {(Object.entries(STATUS_CONFIG) as [WorkLogStatus, typeof statusConfig][]).map(
                      ([s, c]) => (
                        <DropdownMenuItem
                          key={s}
                          onClick={() => onStatusChange(entry.id, s)}
                          className="gap-2"
                        >
                          <c.icon className={`h-4 w-4 ${c.color}`} />
                          {c.label}
                        </DropdownMenuItem>
                      )
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase">Description</Label>
                <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase">Date</Label>
                <p className="text-sm">{formatDateDisplay(entry.date)}</p>
              </div>

              {/* Priority */}
              {entry.priority && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase">Priority</Label>
                  <Badge
                    variant={PRIORITY_CONFIG[entry.priority].variant}
                  >
                    {PRIORITY_CONFIG[entry.priority].label}
                  </Badge>
                </div>
              )}

              {/* Due Date */}
              {entry.dueDate && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase">Due Date</Label>
                  <p className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDateDisplay(entry.dueDate)}
                  </p>
                </div>
              )}

              {/* Project */}
              {entry.project && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase">Project</Label>
                  <Badge variant="secondary" className="gap-1">
                    <FolderOpen className="h-3 w-3" />
                    {entry.project.title}
                  </Badge>
                </div>
              )}

              {/* Tags */}
              {entry.tags.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase">Tags</Label>
                  <div className="flex flex-wrap gap-1">
                    {entry.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        style={{ backgroundColor: tag.color ? `${tag.color}20` : undefined }}
                      >
                        #{tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Flags */}
              <TaskFlagsSection
                flags={entry.flags ?? []}
                onFlagsChange={(flags) => onFlagsChange(entry.id, flags)}
              />

              {/* Timestamps */}
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Created</span>
                  <span>{formatTimestampDisplay(entry.createdAt)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Updated</span>
                  <span>{formatTimestampDisplay(entry.updatedAt)}</span>
                </div>
              </div>
            </div>

            {/* Right Column - Updates/Activity */}
            <div className="space-y-4">
              <TaskUpdatesSection entityType="work_log" entityId={entry.id} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1 gap-2" onClick={() => onEdit(entry)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <Button variant="destructive" size="icon" onClick={() => onDelete(entry.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ProjectFilterProps {
  projects: PersonalProject[];
  selectedProjectId?: string;
  onSelectProject: (projectId?: string) => void;
}

function ProjectFilter({ projects, selectedProjectId, onSelectProject }: ProjectFilterProps) {
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          {selectedProject ? selectedProject.title : 'All Projects'}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={() => onSelectProject(undefined)}>
          All Projects
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {projects.map((project) => (
          <DropdownMenuItem
            key={project.id}
            onClick={() => onSelectProject(project.id)}
            className="gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            {project.title}
            {project.id === selectedProjectId && (
              <Check className="h-4 w-4 ml-auto" />
            )}
          </DropdownMenuItem>
        ))}
        {projects.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No projects yet
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Entry Form Dialog (Updated with Project)
// ============================================================================

interface EntryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: WorkLogEntry;
  defaultDate?: string;
  tags: Tag[];
  projects: PersonalProject[];
  onSave: (data: CreateWorkLogRequest | UpdateWorkLogRequest, id?: string) => Promise<void>;
  onCreateTag: (name: string) => Promise<Tag>;
}

function EntryFormDialog({
  open,
  onOpenChange,
  entry,
  defaultDate,
  tags,
  projects,
  onSave,
  onCreateTag
}: EntryFormDialogProps) {
  const [content, setContent] = useState('');
  const [date, setDate] = useState(getTodayDate());
  const [status, setStatus] = useState<WorkLogStatus>('todo');
  const [priority, setPriority] = useState<WorkLogPriority | 'none'>('none');
  const [dueDate, setDueDate] = useState('');
  const [projectId, setProjectId] = useState<string | 'none'>('none');
  const [isSaving, setIsSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<{
    hashtags: string[];
    date?: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high';
    project?: string;
  }>({
    hashtags: []
  });
  const [lastAppliedDate, setLastAppliedDate] = useState<string | undefined>(undefined);
  const [lastAppliedDueDate, setLastAppliedDueDate] = useState<string | undefined>(undefined);
  const [lastAppliedPriority, setLastAppliedPriority] = useState<string | undefined>(undefined);
  const [lastAppliedProject, setLastAppliedProject] = useState<string | undefined>(undefined);

  // Reset form when dialog opens/closes or entry changes
  useEffect(() => {
    if (open) {
      if (entry) {
        setContent(entry.content);
        setDate(entry.date);
        setStatus(entry.status);
        setPriority(entry.priority ?? 'none');
        setDueDate(entry.dueDate ?? '');
        setProjectId(entry.projectId ?? 'none');
        setLastAppliedDate(undefined);
        setLastAppliedDueDate(undefined);
        setLastAppliedPriority(undefined);
        setLastAppliedProject(undefined);
      } else {
        setContent('');
        setDate(defaultDate ?? getTodayDate());
        setStatus('todo');
        setPriority('none');
        setDueDate('');
        setProjectId('none');
        setLastAppliedDate(undefined);
        setLastAppliedDueDate(undefined);
        setLastAppliedPriority(undefined);
        setLastAppliedProject(undefined);
      }
      setSuggestions({ hashtags: [] });
    }
  }, [open, entry, defaultDate]);

  // Parse content for suggestions with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (content) {
        const parsed = parseContentForSuggestions(content);
        setSuggestions({
          hashtags: parsed.hashtags,
          date: parsed.suggestedDate,
          dueDate: parsed.suggestedDueDate,
          priority: parsed.suggestedPriority,
          project: parsed.suggestedProject
        });

        // Auto-apply date if detected and changed
        if (parsed.suggestedDate && parsed.suggestedDate !== lastAppliedDate) {
          setDate(parsed.suggestedDate);
          setLastAppliedDate(parsed.suggestedDate);
        }

        // Auto-apply due date if detected and changed
        if (parsed.suggestedDueDate && parsed.suggestedDueDate !== lastAppliedDueDate) {
          setDueDate(parsed.suggestedDueDate);
          setLastAppliedDueDate(parsed.suggestedDueDate);
        }

        // Auto-apply priority if detected and changed
        if (parsed.suggestedPriority && parsed.suggestedPriority !== lastAppliedPriority) {
          setPriority(parsed.suggestedPriority);
          setLastAppliedPriority(parsed.suggestedPriority);
        }

        // Auto-apply project if detected and changed
        if (parsed.suggestedProject && parsed.suggestedProject !== lastAppliedProject) {
          // Find matching project by title (case-insensitive)
          const matchingProject = projects.find(
            (p) => p.title.toLowerCase() === parsed.suggestedProject?.toLowerCase()
          );
          if (matchingProject) {
            setProjectId(matchingProject.id);
            setLastAppliedProject(parsed.suggestedProject);
          }
        }
      } else {
        setSuggestions({ hashtags: [] });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [content, lastAppliedDate, lastAppliedDueDate, lastAppliedPriority, lastAppliedProject, projects]);

  const handleSave = async () => {
    if (!content.trim()) return;

    setIsSaving(true);
    try {
      // Parse content to get cleaned version
      const parsed = parseContentForSuggestions(content);

      // Process hashtags: create new tags, reuse existing ones
      const tagIds: string[] = [];
      for (const tagName of parsed.hashtags) {
        const existingTag = tags.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
        if (existingTag) {
          tagIds.push(existingTag.id);
        } else {
          try {
            const newTag = await onCreateTag(tagName);
            tagIds.push(newTag.id);
          } catch (error) {
            console.error('Failed to create tag:', error);
          }
        }
      }

      // Clean content: remove autofill directives and hashtags
      let finalContent = parsed.cleanedContent;
      parsed.hashtags.forEach((tag) => {
        // eslint-disable-next-line security/detect-non-literal-regexp
        finalContent = finalContent.replace(new RegExp(`#${tag}\\b`, 'gi'), '');
      });
      finalContent = finalContent.replace(/\s+/g, ' ').trim();

      const data: CreateWorkLogRequest | UpdateWorkLogRequest = {
        content: finalContent,
        date,
        status,
        priority: priority !== 'none' ? priority : undefined,
        dueDate: dueDate || undefined,
        projectId: projectId !== 'none' ? projectId : undefined,
        tagIds: tagIds.length > 0 ? tagIds : undefined
      };

      await onSave(data, entry?.id);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const getTagStatus = (tagName: string): 'new' | 'existing' => {
    return tags.find((t) => t.name.toLowerCase() === tagName.toLowerCase()) ? 'existing' : 'new';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? 'Edit Entry' : 'New Entry'}</DialogTitle>
          <DialogDescription>
            {entry ? 'Update your work log entry' : 'Add a new entry to your work journal'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">What did you work on?</Label>
            <Textarea
              id="content"
              placeholder="e.g., Fixed bug in login #dev by tomorrow priority: high project: Q1 Launch"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
            />
            {/* Auto-detection Feedback */}
            {(suggestions.date || suggestions.dueDate || suggestions.priority || suggestions.project) && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {suggestions.date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Date: {suggestions.date}
                  </span>
                )}
                {suggestions.priority && (
                  <span className="flex items-center gap-1">
                    Priority: {suggestions.priority.charAt(0).toUpperCase() + suggestions.priority.slice(1)}
                  </span>
                )}
                {suggestions.dueDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Due: {suggestions.dueDate}
                  </span>
                )}
                {suggestions.project && (
                  <span className="flex items-center gap-1">
                    <FolderOpen className="h-3 w-3" />
                    Project: {suggestions.project}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Date & Status Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <DatePicker value={date} onChange={setDate} placeholder="Pick a date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as WorkLogStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([s, config]) => (
                    <SelectItem key={s} value={s}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority & Due Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as WorkLogPriority | 'none')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {Object.entries(PRIORITY_CONFIG).map(([p, config]) => (
                    <SelectItem key={p} value={p}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="Pick due date"
              />
            </div>
          </div>

          {/* Project */}
          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select value={projectId} onValueChange={(v) => setProjectId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Detected Tags */}
          {suggestions.hashtags.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Detected tags</Label>
              <div className="flex flex-wrap gap-1">
                {suggestions.hashtags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={getTagStatus(tag) === 'existing' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    #{tag}
                    {getTagStatus(tag) === 'new' && (
                      <span className="ml-1 text-muted-foreground">(new)</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !content.trim()}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {entry ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Rollover Dialog
// ============================================================================

interface RolloverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRollover: (mode: 'move' | 'copy') => Promise<void>;
  unfinishedCount: number;
}

function RolloverDialog({ open, onOpenChange, onRollover, unfinishedCount }: RolloverDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleRollover = async (mode: 'move' | 'copy') => {
    setIsLoading(true);
    try {
      await onRollover(mode);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rollover Unfinished Tasks</DialogTitle>
          <DialogDescription>
            You have {unfinishedCount} unfinished task(s) from past dates. How would you like to
            handle them?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => handleRollover('move')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MoveRight className="h-4 w-4" />
                Move to Today
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Move tasks from yesterday to today.
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => handleRollover('copy')}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Copy to Today
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Create copies in today.
            </CardContent>
          </Card>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export function JournalPage() {
  const queryClient = useQueryClient();
  
  // Navigation state
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');

  // Filter state
  const [projectFilter, setProjectFilter] = useState<string | undefined>(undefined);

  // UI state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkLogEntry | undefined>();
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [rolloverDialogOpen, setRolloverDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<WorkLogEntry | undefined>();
  const [unfinishedPastEntries, setUnfinishedPastEntries] = useState<WorkLogEntry[]>([]);

  // Calculate date range for query
  const start = useMemo(() => viewMode === 'week' ? getWeekStart(currentDate) : currentDate, [viewMode, currentDate]);
  const from = useMemo(() => formatDate(start), [start]);
  const to = useMemo(() => {
    const end = new Date(start);
    if (viewMode === 'week') {
      end.setDate(end.getDate() + 6);
    }
    return formatDate(end);
  }, [start, viewMode]);

  // TanStack Query hooks for data
  const { data: entriesData, isLoading: entriesLoading, error: entriesError, refetch } = useWorkLogsList({
    from,
    to,
    projectId: projectFilter
  });
  const { data: tagsData, isLoading: tagsLoading } = useTagsList();
  const { data: projectsData, isLoading: projectsLoading } = usePersonalProjectsList();
  
  // Note: rollover mutation not used here as handleRollover loops for multiple dates
  
  // Local state for optimistic updates (synced with query data)
  const [localEntries, setEntries] = useState<WorkLogEntry[]>([]);
  const [localTags, setTags] = useState<Tag[]>([]);
  
  // Sync local state with query data
  useEffect(() => {
    if (entriesData?.items) {
      setEntries(entriesData.items);
    }
  }, [entriesData?.items]);
  
  useEffect(() => {
    if (tagsData?.items) {
      setTags(tagsData.items);
    }
  }, [tagsData?.items]);
  
  // Use local state for optimistic updates, fallback to query data
  const entries = localEntries.length > 0 || !entriesData ? localEntries : (entriesData?.items ?? []);
  const tags = localTags.length > 0 || !tagsData ? localTags : (tagsData?.items ?? []);
  const projects = projectsData?.items ?? [];
  const isLoading = entriesLoading || tagsLoading || projectsLoading;
  const error = entriesError ? (entriesError instanceof Error ? entriesError.message : 'Failed to load journal data') : null;

  // Fetch unfinished tasks from all past dates (before today)
  useEffect(() => {
    const fetchUnfinishedPast = async () => {
      try {
        const yesterday = getYesterdayDate();
        const result = await workLogsApi.list({ 
          from: '2000-01-01',
          to: yesterday,
          status: ['todo', 'in_progress']
        });
        setUnfinishedPastEntries(result.items);
      } catch (err) {
        console.error('Failed to fetch past unfinished tasks:', err);
      }
    };
    
    fetchUnfinishedPast();
  }, []);

  // Count unfinished from any past date (before today)
  const unfinishedPast = useMemo(
    () => unfinishedPastEntries,
    [unfinishedPastEntries]
  );

  // Navigation handlers
  const goToPrevious = () => {
    const prev = new Date(currentDate);
    if (viewMode === 'week') {
      prev.setDate(prev.getDate() - 7);
    } else {
      prev.setDate(prev.getDate() - 1);
    }
    setCurrentDate(prev);
  };

  const goToNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'week') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + 1);
    }
    setCurrentDate(next);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setViewMode('day'); // Switch to day view when clicking Today
  };

  // Entry handlers - optimistic updates
  const handleStatusChange = useCallback(
    async (id: string, newStatus: WorkLogStatus) => {
      // Find the entry to get its old status for rollback
      const entry = entries.find((e) => e.id === id);
      if (!entry || entry.status === newStatus) return;

      const oldStatus = entry.status;

      // Optimistic update: update local state immediately
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                status: newStatus,
                actualEndDate: newStatus === 'done' ? getTodayDate() : e.actualEndDate,
                updatedAt: new Date().toISOString()
              }
            : e
        )
      );

      // Update selected entry if it's the one being changed
      if (selectedEntry?.id === id) {
        setSelectedEntry((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus,
                actualEndDate: newStatus === 'done' ? getTodayDate() : prev.actualEndDate,
                updatedAt: new Date().toISOString()
              }
            : prev
        );
      }

      // Persist to API in background
      try {
        const updateData: UpdateWorkLogRequest = { status: newStatus };
        if (newStatus === 'done') {
          updateData.actualEndDate = getTodayDate();
        }
        await workLogsApi.update(id, updateData);
      } catch (err) {
        console.error('Failed to update status:', err);
        // Rollback on error
        setEntries((prev) =>
          prev.map((e) => (e.id === id ? { ...e, status: oldStatus } : e))
        );
        if (selectedEntry?.id === id) {
          setSelectedEntry((prev) => (prev ? { ...prev, status: oldStatus } : prev));
        }
      }
    },
    [entries, selectedEntry, setEntries]
  );

  const handleFlagsChange = useCallback(
    async (id: string, newFlags: TaskUpdateFlag[]) => {
      // Optimistic update
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, flags: newFlags, updatedAt: new Date().toISOString() }
            : e
        )
      );

      if (selectedEntry?.id === id) {
        setSelectedEntry((prev) =>
          prev ? { ...prev, flags: newFlags, updatedAt: new Date().toISOString() } : prev
        );
      }

      // Persist to API
      try {
        await workLogsApi.update(id, { flags: newFlags });
      } catch (err) {
        console.error('Failed to update flags:', err);
        // Rollback would require storing old flags, simplified for now
      }
    },
    [selectedEntry, setEntries]
  );

  const handleEdit = useCallback((entry: WorkLogEntry) => {
    setEditingEntry(entry);
    setDefaultDate(undefined);
    setFormDialogOpen(true);
  }, []);

  const handleAddEntry = useCallback(() => {
    setEditingEntry(undefined);
    setDefaultDate(getTodayDate());
    setFormDialogOpen(true);
  }, []);

  const handleSaveEntry = useCallback(
    async (data: CreateWorkLogRequest | UpdateWorkLogRequest, id?: string) => {
      if (id) {
        // Optimistic update for edit
        setEntries((prev) =>
          prev.map((e) =>
            e.id === id
              ? { ...e, ...data, updatedAt: new Date().toISOString() }
              : e
          )
        );
        if (selectedEntry?.id === id) {
          setSelectedEntry((prev) =>
            prev ? { ...prev, ...data, updatedAt: new Date().toISOString() } : prev
          );
        }
        await workLogsApi.update(id, data as UpdateWorkLogRequest);
      } else {
        // For create, we need to refetch to get the new entry with proper ID
        const result = await workLogsApi.create(data as CreateWorkLogRequest);
        setEntries((prev) => [result.entry, ...prev]);
      }
      // Invalidate dashboard queries so changes appear immediately
      queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.all });
    },
    [selectedEntry, setEntries, queryClient]
  );

  const handleDeleteEntry = useCallback(async () => {
    if (!deleteConfirmId) return;
    const entryToDelete = entries.find((e) => e.id === deleteConfirmId);
    
    // Optimistic delete
    setEntries((prev) => prev.filter((e) => e.id !== deleteConfirmId));
    if (selectedEntry?.id === deleteConfirmId) {
      setSelectedEntry(undefined);
    }
    
    try {
      await workLogsApi.delete(deleteConfirmId);
      // Invalidate dashboard queries
      queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.all });
    } catch (err) {
      console.error('Failed to delete entry:', err);
      // Rollback on error
      if (entryToDelete) {
        setEntries((prev) => [...prev, entryToDelete]);
      }
    } finally {
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, entries, selectedEntry, setEntries, queryClient]);

  const handleCreateTag = useCallback(
    async (name: string): Promise<Tag> => {
      const result = await tagsApi.create({ name });
      setTags((prev) => [...prev, result.tag]);
      return result.tag;
    },
    [setTags]
  );

  const handleRollover = useCallback(
    async (mode: 'move' | 'copy') => {
      // Collect all unique dates from past unfinished tasks
      const pastDates = [...new Set(unfinishedPast.map(e => e.date))];
      const todayDate = getTodayDate();

      // Process each past date's unfinished tasks
      for (const fromDate of pastDates) {
        await workLogsApi.rollover({
          fromDate,
          toDate: todayDate,
          mode
        });
      }
      
      // Refetch current week entries
      refetch();
      
      // Refetch unfinished past entries
      try {
        const yesterday = getYesterdayDate();
        const result = await workLogsApi.list({ 
          from: '2000-01-01',
          to: yesterday,
          status: ['todo', 'in_progress']
        });
        setUnfinishedPastEntries(result.items);
      } catch (err) {
        console.error('Failed to refresh past unfinished tasks:', err);
      }
    },
    [unfinishedPast, refetch]
  );

  // Summary stats
  const weekStats = useMemo(() => {
    const total = entries.length;
    const done = entries.filter((e) => e.status === 'done').length;
    const inProgress = entries.filter((e) => e.status === 'in_progress').length;
    const todo = entries.filter((e) => e.status === 'todo').length;
    return { total, done, inProgress, todo };
  }, [entries]);

  return (
    <AppPage
      title="Work Journal"
      description="Track your daily tasks and activities"
      actions={
        <div className="flex items-center gap-2">
          {/* Rollover Button */}
          {unfinishedPast.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRolloverDialogOpen(true)}
                    className="gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Rollover ({unfinishedPast.length})
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Move unfinished tasks from past dates to today</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Add Entry Button */}
          <Button size="sm" onClick={handleAddEntry} className="gap-2">
            <Plus className="h-4 w-4" />
            New Entry
          </Button>
        </div>
      }
    >
      <AppPageContent className="flex flex-col h-full overflow-hidden">
        {/* Header: Navigation + Filter + Stats */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={goToPrevious}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="text-lg font-semibold min-w-[200px] text-center">
              {viewMode === 'week' 
                ? getWeekRangeLabel(getWeekStart(currentDate))
                : formatFullDate(currentDate)
              }
            </div>
            <Button variant="outline" size="icon" onClick={goToNext}>
              <ArrowRight className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center rounded-md border p-1 bg-muted/20">
              <Button 
                variant={viewMode === 'day' ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('day')}
                className="h-7 px-3 text-xs"
              >
                Day
              </Button>
              <Button 
                variant={viewMode === 'week' ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => setViewMode('week')}
                className="h-7 px-3 text-xs"
              >
                Week
              </Button>
            </div>

            <Button variant="ghost" size="sm" onClick={goToToday}>
              Today
            </Button>
            
            <Separator orientation="vertical" className="h-6" />
            
            {/* Project Filter */}
            <ProjectFilter
              projects={projects}
              selectedProjectId={projectFilter}
              onSelectProject={setProjectFilter}
            />
          </div>

          {/* Weekly Stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{weekStats.total}</strong> entries
            </span>
            <span className="text-green-500">
              <strong>{weekStats.done}</strong> done
            </span>
            <span className="text-blue-500">
              <strong>{weekStats.inProgress}</strong> in progress
            </span>
            <span>
              <strong>{weekStats.todo}</strong> to do
            </span>
          </div>
        </div>

        {/* Main Content: Kanban + Detail Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Loading / Error States */}
          {isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {error && (
            <div className="flex-1 flex flex-col items-center justify-center text-destructive">
              <p>{error}</p>
              <Button variant="outline" onClick={() => refetch()} className="mt-4">
                Retry
              </Button>
            </div>
          )}

          {/* Kanban Board */}
          {!isLoading && !error && (
            <DragDropProvider
              onDragOver={(event) => {
                const { source, target } = event.operation;
                
                // Only handle item drags (not column drags)
                if (!source || source.type !== 'item') return;
                
                // Get the target column (status)
                let targetStatus: WorkLogStatus | undefined;
                
                if (target?.type === 'column') {
                  // Hovering over a column
                  targetStatus = target.id as WorkLogStatus;
                } else if (target?.type === 'item') {
                  // Hovering over another item - get that item's column/status
                  const targetEntry = entries.find((e) => e.id === target.id);
                  targetStatus = targetEntry?.status;
                }
                
                // If we have a valid target status and it's different, update the entry's group
                const sourceEntry = entries.find((e) => e.id === source.id);
                if (sourceEntry && targetStatus && sourceEntry.status !== targetStatus) {
                  // Update the entry's status locally for visual feedback
                  setEntries((prev) =>
                    prev.map((e) =>
                      e.id === source.id ? { ...e, status: targetStatus } : e
                    )
                  );
                  
                  // Also update selectedEntry if it's the one being dragged
                  if (selectedEntry?.id === source.id) {
                    setSelectedEntry((prev) =>
                      prev ? { ...prev, status: targetStatus } : prev
                    );
                  }
                }
              }}
              onDragEnd={(event) => {
                const { source, target } = event.operation;
                
                // Only handle item drags (not column drags)
                if (!source || source.type !== 'item') return;
                
                // If canceled, don't persist (but state is already updated via onDragOver)
                if (event.canceled) {
                  // Refetch to restore original state
                  refetch();
                  return;
                }
                
                // Get the target column (status) for persistence
                let targetStatus: WorkLogStatus | undefined;
                
                if (target?.type === 'column') {
                  targetStatus = target.id as WorkLogStatus;
                } else if (target?.type === 'item') {
                  const targetEntry = entries.find((e) => e.id === target.id);
                  targetStatus = targetEntry?.status;
                }
                
                // Persist the status change to the API
                if (targetStatus) {
                  // The UI is already updated via onDragOver, just persist
                  const entryId = source.id as string;
                  const entry = entries.find((e) => e.id === entryId);
                  
                  // Only call API if status actually changed
                  if (entry) {
                    const updateData: UpdateWorkLogRequest = { status: targetStatus };
                    if (targetStatus === 'done') {
                      updateData.actualEndDate = getTodayDate();
                    }
                    workLogsApi.update(entryId, updateData).catch((err) => {
                      console.error('Failed to update status:', err);
                      refetch(); // Rollback on error
                    });
                  }
                }
              }}
            >
              <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
                {KANBAN_COLUMNS.map((status, index) => (
                  <KanbanColumn
                    key={status}
                    status={status}
                    index={index}
                    entries={entries}
                    selectedEntry={selectedEntry}
                    onSelectEntry={setSelectedEntry}
                  />
                ))}
              </div>
            </DragDropProvider>
          )}
        </div>
      </AppPageContent>

      {/* Task Detail Modal */}
      <TaskDetailModal
        entry={selectedEntry}
        open={!!selectedEntry}
        onOpenChange={(open) => !open && setSelectedEntry(undefined)}
        tags={tags}
        projects={projects}
        onEdit={handleEdit}
        onDelete={setDeleteConfirmId}
        onStatusChange={handleStatusChange}
        onFlagsChange={handleFlagsChange}
      />

      {/* Entry Form Dialog */}
      <EntryFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        entry={editingEntry}
        defaultDate={defaultDate}
        tags={tags}
        projects={projects}
        onSave={handleSaveEntry}
        onCreateTag={handleCreateTag}
      />

      {/* Rollover Dialog */}
      <RolloverDialog
        open={rolloverDialogOpen}
        onOpenChange={setRolloverDialogOpen}
        onRollover={handleRollover}
        unfinishedCount={unfinishedPast.length}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEntry}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPage>
  );
}
