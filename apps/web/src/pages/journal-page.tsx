import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  Circle,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Info,
  Loader2,
  MoveRight,
  Plus,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { WorkLogStatus, WorkLogPriority } from '@workspace/shared';

import {
  tagsApi,
  workLogsApi,
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
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  formatDate,
  formatDisplayDate,
  getWeekDates,
  getWeekRangeLabel,
  getWeekStart,
  getTodayDate,
  getYesterdayDate,
  isToday,
  parseContentForSuggestions
} from '@/utils/journal-parser';


// ============================================================================
// Types & Constants
// ============================================================================

const STATUS_CONFIG: Record<WorkLogStatus, { label: string; icon: typeof Circle; color: string }> = {
  todo: { label: 'To Do', icon: Circle, color: 'text-muted-foreground' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-blue-500' },
  done: { label: 'Done', icon: Check, color: 'text-green-500' },
  blocked: { label: 'Blocked', icon: X, color: 'text-red-500' }
};

const PRIORITY_CONFIG: Record<WorkLogPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-gray-500' },
  medium: { label: 'Medium', color: 'bg-yellow-500' },
  high: { label: 'High', color: 'bg-red-500' }
};

const FOCUS_MODE_KEY = 'journal_focus_mode';

// ============================================================================
// Hooks
// ============================================================================

function useJournalData(weekStart: Date) {
  const [entries, setEntries] = useState<WorkLogEntry[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
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
      const [entriesRes, tagsRes] = await Promise.all([
        workLogsApi.list({ from, to }),
        tagsApi.list()
      ]);
      setEntries(entriesRes.items);
      setTags(tagsRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load journal data');
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { entries, tags, isLoading, error, refetch: fetchData, setTags };
}

// ============================================================================
// Sub-Components
// ============================================================================

interface LogEntryCardProps {
  entry: WorkLogEntry;
  onStatusChange: (id: string, status: WorkLogStatus) => void;
  onEdit: (entry: WorkLogEntry) => void;
  onDelete: (id: string) => void;
}

function LogEntryCard({ entry, onStatusChange, onEdit, onDelete }: LogEntryCardProps) {
  const statusConfig = STATUS_CONFIG[entry.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="group relative flex items-start gap-3 rounded-lg border bg-card p-3 hover:border-primary/50 transition-colors">
      {/* Status Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 mt-0.5">
            <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(Object.entries(STATUS_CONFIG) as [WorkLogStatus, typeof statusConfig][]).map(
            ([status, config]) => (
              <DropdownMenuItem
                key={status}
                onClick={() => onStatusChange(entry.id, status)}
                className="gap-2"
              >
                <config.icon className={`h-4 w-4 ${config.color}`} />
                {config.label}
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${entry.status === 'done' ? 'line-through text-muted-foreground' : ''}`}
        >
          {entry.content}
        </p>

        {/* Tags & Metadata */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
              {entry.dueDate}
            </Badge>
          )}
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
      </div>

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(entry)}>
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          onClick={() => onDelete(entry.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface DayColumnProps {
  date: Date;
  entries: WorkLogEntry[];
  isFocusMode: boolean;
  isExpanded: boolean;
  onStatusChange: (id: string, status: WorkLogStatus) => void;
  onEdit: (entry: WorkLogEntry) => void;
  onDelete: (id: string) => void;
  onToggleExpand: () => void;
}

function DayColumn({
  date,
  entries,
  isFocusMode,
  isExpanded,
  onStatusChange,
  onEdit,
  onDelete,
  onToggleExpand
}: DayColumnProps) {
  const dateStr = formatDate(date);
  const dayEntries = entries.filter((e) => e.date === dateStr);
  const filteredEntries = isFocusMode
    ? dayEntries.filter((e) => e.status === 'todo' || e.status === 'in_progress')
    : dayEntries;

  const today = isToday(date);
  const hasEntries = filteredEntries.length > 0;

  // Don't render collapsed empty days (except today)
  if (!hasEntries && !today && !isExpanded) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border ${today ? 'border-primary/50 bg-primary/5' : 'bg-card'}`}
    >
      {/* Day Header */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <div className={`flex flex-col items-start ${today ? 'text-primary' : ''}`}>
            <span className="text-sm font-medium">
              {formatDisplayDate(date)}
            </span>
            {today && <span className="text-xs text-primary font-medium">Today</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {filteredEntries.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {filteredEntries.length} {filteredEntries.length === 1 ? 'entry' : 'entries'}
            </Badge>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Entries - Collapsible */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {filteredEntries.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6 border border-dashed rounded-lg">
              {isFocusMode ? 'No active tasks' : 'No entries for this day'}
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <LogEntryCard
                key={entry.id}
                entry={entry}
                onStatusChange={onStatusChange}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface EntryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: WorkLogEntry;
  defaultDate?: string;
  tags: Tag[];
  onSave: (data: CreateWorkLogRequest | UpdateWorkLogRequest, id?: string) => Promise<void>;
  onCreateTag: (name: string) => Promise<Tag>;
}

function EntryFormDialog({
  open,
  onOpenChange,
  entry,
  defaultDate,
  tags,
  onSave,
  onCreateTag
}: EntryFormDialogProps) {
  const [content, setContent] = useState('');
  const [date, setDate] = useState(getTodayDate());
  const [status, setStatus] = useState<WorkLogStatus>('todo');
  const [priority, setPriority] = useState<WorkLogPriority | 'none'>('none');
  const [dueDate, setDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<{
    hashtags: string[];
    date?: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high';
  }>({
    hashtags: []
  });
  const [lastAppliedDate, setLastAppliedDate] = useState<string | undefined>(undefined);
  const [lastAppliedDueDate, setLastAppliedDueDate] = useState<string | undefined>(undefined);
  const [lastAppliedPriority, setLastAppliedPriority] = useState<string | undefined>(undefined);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (entry) {
        setContent(entry.content);
        setDate(entry.date);
        setStatus(entry.status);
        setPriority(entry.priority ?? 'none');
        setDueDate(entry.dueDate ?? '');
        setLastAppliedDate(entry.date);
        setLastAppliedDueDate(entry.dueDate);
        setLastAppliedPriority(entry.priority);
      } else {
        setContent('');
        setDate(defaultDate ?? getTodayDate());
        setStatus('todo');
        setPriority('none');
        setDueDate('');
        setLastAppliedDate(undefined);
        setLastAppliedDueDate(undefined);
        setLastAppliedPriority(undefined);
      }
      setSuggestions({ hashtags: [] });
    }
  }, [open, entry, defaultDate]);

  // Parse content for suggestions with debouncing
  // NOTE: Content is NOT modified while typing - only cleaned on save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (content) {
        const parsed = parseContentForSuggestions(content);
        setSuggestions({
          hashtags: parsed.hashtags,
          date: parsed.suggestedDate,
          dueDate: parsed.suggestedDueDate,
          priority: parsed.suggestedPriority
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
      } else {
        setSuggestions({ hashtags: [] });
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [content, lastAppliedDate, lastAppliedDueDate, lastAppliedPriority]);

  const handleSave = async () => {
    if (!content.trim()) return;

    setIsSaving(true);
    try {
      // Parse content to get cleaned version (removes dates, priority, due, prepositions)
      const parsed = parseContentForSuggestions(content);
      
      // Process hashtags: create new tags, reuse existing ones
      const tagIds: string[] = [];
      for (const tagName of parsed.hashtags) {
        const existingTag = tags.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
        if (existingTag) {
          // Reuse existing tag
          tagIds.push(existingTag.id);
        } else {
          // Create new tag
          try {
            const newTag = await onCreateTag(tagName);
            tagIds.push(newTag.id);
          } catch (error) {
            console.error('Failed to create tag:', error);
          }
        }
      }

      // Start with cleaned content (autofill directives removed)
      let finalContent = parsed.cleanedContent;
      
      // Remove hashtags from content (tags are tracked separately)
      parsed.hashtags.forEach((tag) => {
        // eslint-disable-next-line security/detect-non-literal-regexp
        finalContent = finalContent.replace(new RegExp(`#${tag}\\b`, 'gi'), '');
      });
      // Clean up extra whitespace after removing hashtags
      finalContent = finalContent.replace(/\s+/g, ' ').trim();

      const data: CreateWorkLogRequest | UpdateWorkLogRequest = {
        content: finalContent,
        date,
        status,
        priority: priority !== 'none' ? priority : undefined,
        dueDate: dueDate || undefined,
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
              placeholder="e.g., Fixed bug in login flow #dev by tomorrow"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
            />
            {/* Auto-detection Feedback */}
            {(suggestions.date || suggestions.dueDate || suggestions.priority) && (
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
              </div>
            )}
          </div>

          {/* Date & Status Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-1">
                Date
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Which day this log entry belongs to (organizes by day)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as WorkLogStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(STATUS_CONFIG) as [WorkLogStatus, (typeof STATUS_CONFIG)[WorkLogStatus]][]).map(
                    ([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <config.icon className={`h-4 w-4 ${config.color}`} />
                          {config.label}
                        </div>
                      </SelectItem>
                    )
                  )}
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
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(Object.entries(PRIORITY_CONFIG) as [WorkLogPriority, (typeof PRIORITY_CONFIG)[WorkLogPriority]][]).map(
                    ([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate" className="flex items-center gap-1">
                Due Date
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>When this task should be completed (deadline)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Tags Preview */}
          {suggestions.hashtags.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tags from content</Label>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.hashtags.map((tagName) => {
                  const status = getTagStatus(tagName);
                  return (
                    <Badge
                      key={tagName}
                      variant={status === 'existing' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      #{tagName}
                      {status === 'new' && <span className="ml-1 text-[10px] opacity-60">(new)</span>}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!content.trim() || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {entry ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
              Move tasks from yesterday to today. Original entries will be updated.
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
              Create copies in today. Original entries remain unchanged.
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

  // UI state
  const [focusMode, setFocusMode] = useState(() => {
    const saved = localStorage.getItem(FOCUS_MODE_KEY);
    return saved === 'true';
  });
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WorkLogEntry | undefined>();
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [rolloverDialogOpen, setRolloverDialogOpen] = useState(false);
  
  // Track expanded days - today expanded by default
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => {
    return new Set([getTodayDate()]);
  });

  // Data
  const { entries, tags, isLoading, error, refetch, setTags } = useJournalData(currentWeekStart);

  // Week dates array
  const weekDates = useMemo(() => getWeekDates(currentWeekStart), [currentWeekStart]);

  // Count unfinished from yesterday
  const yesterdayStr = getYesterdayDate();
  const unfinishedYesterday = useMemo(
    () =>
      entries.filter(
        (e) => e.date === yesterdayStr && e.status !== 'done' && e.status !== 'blocked'
      ),
    [entries, yesterdayStr]
  );

  // Persist focus mode
  useEffect(() => {
    localStorage.setItem(FOCUS_MODE_KEY, focusMode.toString());
  }, [focusMode]);

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

  // Entry handlers
  const handleStatusChange = useCallback(
    async (id: string, status: WorkLogStatus) => {
      try {
        const updateData: UpdateWorkLogRequest = { status };
        if (status === 'done') {
          updateData.actualEndDate = getTodayDate();
        }
        await workLogsApi.update(id, updateData);
        refetch();
      } catch (err) {
        console.error('Failed to update status:', err);
      }
    },
    [refetch]
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

  const handleToggleDay = useCallback((dateStr: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    setExpandedDays(new Set(weekDates.map(d => formatDate(d))));
  }, [weekDates]);

  const handleCollapseAll = useCallback(() => {
    setExpandedDays(new Set([getTodayDate()])); // Keep today expanded
  }, []);

  const handleSaveEntry = useCallback(
    async (data: CreateWorkLogRequest | UpdateWorkLogRequest, id?: string) => {
      if (id) {
        await workLogsApi.update(id, data as UpdateWorkLogRequest);
      } else {
        await workLogsApi.create(data as CreateWorkLogRequest);
      }
      refetch();
    },
    [refetch]
  );

  const handleDeleteEntry = useCallback(async () => {
    if (!deleteConfirmId) return;
    try {
      await workLogsApi.delete(deleteConfirmId);
      refetch();
    } finally {
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, refetch]);

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

          {/* Focus Mode Toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={focusMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFocusMode(!focusMode)}
                  className="gap-2"
                >
                  {focusMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  Focus
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {focusMode ? 'Showing active tasks only' : 'Show all tasks'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Add Entry Button */}
          <Button size="sm" onClick={handleAddEntry} className="gap-2">
            <Plus className="h-4 w-4" />
            New Entry
          </Button>
        </div>
      }
    >
      <AppPageContent>
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6">
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
          </div>

          {/* Weekly Stats & Actions */}
          <div className="flex items-center gap-6">
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
            
            {/* Expand/Collapse All */}
            <div className="flex items-center gap-1 border-l pl-4">
              <Button variant="ghost" size="sm" onClick={handleExpandAll} className="text-xs">
                Expand All
              </Button>
              <span className="text-muted-foreground">/</span>
              <Button variant="ghost" size="sm" onClick={handleCollapseAll} className="text-xs">
                Collapse
              </Button>
            </div>
          </div>
        </div>

        {/* Loading / Error States */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-destructive">
            <p>{error}</p>
            <Button variant="outline" onClick={refetch} className="mt-4">
              Retry
            </Button>
          </div>
        )}

        {/* Week Grid */}
        {!isLoading && !error && (
          <div className="space-y-3 max-w-4xl mx-auto">
            {weekDates.map((date) => {
              const dateStr = formatDate(date);
              return (
                <DayColumn
                  key={dateStr}
                  date={date}
                  entries={entries}
                  isFocusMode={focusMode}
                  isExpanded={expandedDays.has(dateStr)}
                  onStatusChange={handleStatusChange}
                  onEdit={handleEdit}
                  onDelete={setDeleteConfirmId}
                  onToggleExpand={() => handleToggleDay(dateStr)}
                />
              );
            })}
          </div>
        )}
      </AppPageContent>

      {/* Entry Form Dialog */}
      <EntryFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        entry={editingEntry}
        defaultDate={defaultDate}
        tags={tags}
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
