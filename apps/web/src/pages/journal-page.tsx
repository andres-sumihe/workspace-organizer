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
  GripVertical,
  Loader2,
  MoveRight,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { WorkLogStatus, WorkLogPriority, PersonalProject } from '@workspace/shared';

import {
  tagsApi,
  workLogsApi,
  personalProjectsApi,
  type Tag,
  type WorkLogEntry,
  type CreateWorkLogRequest,
  type UpdateWorkLogRequest
} from '@/api/journal';
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
  parseContentForSuggestions
} from '@/utils/journal-parser';

// ============================================================================
// Types & Constants
// ============================================================================

const STATUS_CONFIG: Record<WorkLogStatus, { label: string; icon: typeof Circle; color: string; bgColor: string }> = {
  todo: { label: 'To Do', icon: Circle, color: 'text-muted-foreground', bgColor: 'bg-muted/50' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  done: { label: 'Done', icon: Check, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  blocked: { label: 'Blocked', icon: X, color: 'text-red-500', bgColor: 'bg-red-500/10' }
};

const PRIORITY_CONFIG: Record<WorkLogPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-gray-500' },
  medium: { label: 'Medium', color: 'bg-yellow-500' },
  high: { label: 'High', color: 'bg-red-500' }
};

// Kanban columns in order
const KANBAN_COLUMNS: WorkLogStatus[] = ['todo', 'in_progress', 'done'];

// ============================================================================
// Hooks
// ============================================================================

function useJournalData(weekStart: Date, projectFilter?: string) {
  const [entries, setEntries] = useState<WorkLogEntry[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [projects, setProjects] = useState<PersonalProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const from = formatDate(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const to = formatDate(weekEnd);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [entriesRes, tagsRes, projectsRes] = await Promise.all([
        workLogsApi.list({ from, to, projectId: projectFilter }),
        tagsApi.list(),
        personalProjectsApi.list()
      ]);
      setEntries(entriesRes.items);
      setTags(tagsRes.items);
      setProjects(projectsRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load journal data');
    } finally {
      setIsLoading(false);
    }
  }, [from, to, projectFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { entries, tags, projects, isLoading, error, refetch: fetchData, setEntries, setTags, setProjects };
}

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
        p-3 rounded-lg border cursor-pointer transition-all
        hover:border-primary/50 hover:shadow-sm
        ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card'}
        ${isDragging ? 'opacity-50 shadow-lg ring-2 ring-primary scale-105' : ''}
      `}
    >
      {/* Drag Handle + Content */}
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 mt-0.5 text-muted-foreground/50 cursor-grab shrink-0" />
        <p className={`text-sm flex-1 ${entry.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
          {entry.content}
        </p>
      </div>

      {/* Metadata Row */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 ml-6">
        {entry.priority && (
          <Badge
            variant="outline"
            className={`text-xs ${PRIORITY_CONFIG[entry.priority].color} text-white border-0`}
          >
            {PRIORITY_CONFIG[entry.priority].label}
          </Badge>
        )}
        {entry.dueDate && (
          <Badge variant="outline" className="text-xs gap-1">
            <Calendar className="h-3 w-3" />
            {formatDateDisplay(entry.dueDate)}
          </Badge>
        )}
        {entry.project && (
          <Badge variant="secondary" className="text-xs gap-1">
            <FolderOpen className="h-3 w-3" />
            {entry.project.title}
          </Badge>
        )}
      </div>

      {/* Tags */}
      {entry.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 ml-6">
          {entry.tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="text-xs"
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
      className={`flex flex-col rounded-lg border ${config.bgColor} min-w-[280px] max-w-[320px] flex-1`}
    >
      {/* Column Header */}
      <div className="flex items-center gap-2 p-3 border-b">
        <StatusIcon className={`h-4 w-4 ${config.color}`} />
        <span className="font-medium text-sm">{config.label}</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {columnEntries.length}
        </Badge>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2 min-h-[100px]">
          {columnEntries.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8 border-2 border-dashed border-muted rounded-lg">
              Drop tasks here
            </div>
          ) : (
            columnEntries.map((entry, idx) => (
              <KanbanCard
                key={entry.id}
                entry={entry}
                index={idx}
                isSelected={selectedEntry?.id === entry.id}
                onSelect={onSelectEntry}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface TaskDetailPanelProps {
  entry: WorkLogEntry;
  tags: Tag[];
  projects: PersonalProject[];
  onClose: () => void;
  onEdit: (entry: WorkLogEntry) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: WorkLogStatus) => void;
}

function TaskDetailPanel({ 
  entry, 
  tags: _tags, 
  projects: _projects,
  onClose, 
  onEdit, 
  onDelete,
  onStatusChange 
}: TaskDetailPanelProps) {
  // _tags and _projects reserved for future use (e.g., inline tag/project editing)
  void _tags;
  void _projects;
  const statusConfig = STATUS_CONFIG[entry.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="w-[400px] border-l bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Task Details</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
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

          {/* Content */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase">Description</Label>
            <p className="text-sm">{entry.content}</p>
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
                className={`${PRIORITY_CONFIG[entry.priority].color} text-white border-0`}
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
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t flex gap-2">
        <Button variant="outline" className="flex-1 gap-2" onClick={() => onEdit(entry)}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
        <Button variant="destructive" size="icon" onClick={() => onDelete(entry.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
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
            You have {unfinishedCount} unfinished task(s) from yesterday. How would you like to
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
  // Week navigation state
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));

  // Filter state
  const [projectFilter, setProjectFilter] = useState<string | undefined>(undefined);

  // UI state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkLogEntry | undefined>();
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [rolloverDialogOpen, setRolloverDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<WorkLogEntry | undefined>();

  // Data
  const { entries, tags, projects, isLoading, error, refetch, setEntries, setTags } = useJournalData(
    currentWeekStart,
    projectFilter
  );

  // Count unfinished from yesterday
  const yesterdayStr = getYesterdayDate();
  const unfinishedYesterday = useMemo(
    () =>
      entries.filter(
        (e) => e.date === yesterdayStr && e.status !== 'done' && e.status !== 'blocked'
      ),
    [entries, yesterdayStr]
  );

  // Navigation handlers
  const goToPreviousWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(getWeekStart(new Date()));
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
    },
    [selectedEntry, setEntries]
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
    } catch (err) {
      console.error('Failed to delete entry:', err);
      // Rollback on error
      if (entryToDelete) {
        setEntries((prev) => [...prev, entryToDelete]);
      }
    } finally {
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, entries, selectedEntry, setEntries]);

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
      await workLogsApi.rollover({
        fromDate: yesterdayStr,
        toDate: getTodayDate(),
        mode
      });
      refetch();
    },
    [yesterdayStr, refetch]
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
          {unfinishedYesterday.length > 0 && (
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
                    Rollover ({unfinishedYesterday.length})
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Move unfinished tasks from yesterday to today</TooltipContent>
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
            <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="text-lg font-semibold min-w-[200px] text-center">
              {getWeekRangeLabel(currentWeekStart)}
            </div>
            <Button variant="outline" size="icon" onClick={goToNextWeek}>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToCurrentWeek}>
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
              <Button variant="outline" onClick={refetch} className="mt-4">
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

          {/* Task Detail Panel */}
          {!isLoading && !error && selectedEntry && (
            <TaskDetailPanel
              entry={selectedEntry}
              tags={tags}
              projects={projects}
              onClose={() => setSelectedEntry(undefined)}
              onEdit={handleEdit}
              onDelete={setDeleteConfirmId}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </AppPageContent>

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
        unfinishedCount={unfinishedYesterday.length}
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
