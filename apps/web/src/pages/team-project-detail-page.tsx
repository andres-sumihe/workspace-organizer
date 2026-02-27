import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowUpDown,
  Calendar,
  Check,
  ChevronsLeft,
  ChevronsRight,
  Circle,
  Clock,
  ExternalLink,
  FileText,
  Hash,
  ListTodo,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Pin,
  Plus,
  Search,
  StickyNote,
  Trash2,
  Users as UsersIcon,
  X
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type {
  TeamProjectStatus,
  TeamNote,
  TeamTask,
  TeamTaskStatus,
  TeamTaskPriority,
  TaskUpdateFlag,
  CreateTeamNoteRequest,
  UpdateTeamNoteRequest,
  CreateTeamTaskRequest,
  UpdateTeamTaskRequest,
} from '@workspace/shared';

import {
  useTeamProjectDetail,
  useTeamNoteList,
  useCreateTeamNote,
  useUpdateTeamNote,
  useDeleteTeamNote,
  useTeamTaskList,
  useCreateTeamTask,
  useUpdateTeamTask,
  useDeleteTeamTask,
  useTeamEventStream,
} from '@/features/team-projects';
import { TeamNoteEditor } from '@/features/team-projects/components/team-note-editor';
import { TeamNoteContentViewer } from '@/features/team-projects/components/team-note-content-viewer';
import { TeamTaskDetailModal } from '@/features/team-projects/components/team-task-detail-modal';
import {
  useCollaborationStatus,
  useCollaborationProvider,
} from '@/features/team-projects/hooks/use-collaboration';
import { AppPage, AppPageTabs } from '@/components/layout/app-page';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MentionTextarea } from '@/components/ui/mention-input';
import { extractPlainText } from '@/components/ui/mention-content-view';
import { readFileAsBase64 } from '@/lib/base64-image';
import { parseContentForSuggestions } from '@/features/journal/utils/journal-parser';

// ============================================================================
// Types & Constants
// ============================================================================

type TabValue = 'overview' | 'tasks' | 'notes';

const PROJECT_STATUS_CONFIG: Record<
  TeamProjectStatus,
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

const TASK_STATUS_CONFIG: Record<
  TeamTaskStatus,
  { label: string; icon: typeof Circle; color: string; bgColor: string; accent: string }
> = {
  pending: {
    label: 'Todo',
    icon: Circle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    accent: 'before:bg-gray-400'
  },
  in_progress: {
    label: 'In Progress',
    icon: Clock,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    accent: 'before:bg-blue-400'
  },
  completed: {
    label: 'Completed',
    icon: Check,
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    accent: 'before:bg-green-400'
  },
  cancelled: {
    label: 'Cancelled',
    icon: X,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    accent: 'before:bg-red-400'
  }
};

const TASK_PRIORITY_CONFIG: Record<
  TeamTaskPriority,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  low: { label: 'Low', variant: 'secondary' },
  medium: { label: 'Med', variant: 'outline' },
  high: { label: 'High', variant: 'destructive' },
  urgent: { label: 'URG', variant: 'destructive' }
};

const KANBAN_COLUMNS: TeamTaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

// Priority weight for sorting (higher = more important)
const PRIORITY_WEIGHT: Record<TeamTaskPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
};

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

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function getDaysUntilDue(dueDate?: string): { text: string; urgent: boolean } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return { text: `${Math.abs(diff)} days overdue`, urgent: true };
  if (diff === 0) return { text: 'Due today', urgent: true };
  if (diff === 1) return { text: 'Due tomorrow', urgent: true };
  if (diff <= 7) return { text: `${diff} days left`, urgent: false };
  return { text: `${diff} days left`, urgent: false };
}

// ============================================================================
// Kanban Sub-Components
// ============================================================================

interface KanbanCardProps {
  task: TeamTask;
  index: number;
  onEdit: (task: TeamTask) => void;
  onDelete: (task: TeamTask) => void;
}

function KanbanCard({ task, index, onEdit, onDelete }: KanbanCardProps) {
  const { ref, isDragging } = useSortable({
    id: task.id,
    index,
    type: 'item',
    accept: 'item',
    group: task.status
  });

  return (
    <div
      ref={ref}
      className={`
        relative p-3 rounded-[3px] cursor-pointer transition-all duration-100 group
        shadow-[0_1px_1px_rgba(9,30,66,0.25),0_0_1px_rgba(9,30,66,0.31)]
        dark:shadow-[0_1px_1px_rgba(0,0,0,0.5),0_0_1px_rgba(0,0,0,0.5)]
        before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.75 ${TASK_STATUS_CONFIG[task.status].accent}
        bg-white dark:bg-[#2C333F] hover:bg-[#F4F5F7] dark:hover:bg-[#353D4A]
        ${isDragging ? 'opacity-70 shadow-2xl scale-[1.02] rotate-1 z-50' : ''}
      `}
      onClick={() => onEdit(task)}
    >
      {/* Title */}
      <div className="flex items-start gap-2 ml-1">
        <div className={`text-sm leading-snug flex-1 font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground/90'}`}>
          {task.title}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(task); }}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(task); }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Metadata Row */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 ml-1">
        <Badge
          variant={TASK_PRIORITY_CONFIG[task.priority].variant}
          className="text-[10px] h-4 px-1 font-bold rounded-[2px] uppercase tracking-tighter"
        >
          {TASK_PRIORITY_CONFIG[task.priority].label}
        </Badge>
        {task.dueDate && (
          <Badge variant="outline" className="text-[10px] h-4 px-1 gap-1 border-none bg-zinc-200/80 dark:bg-zinc-800 text-muted-foreground rounded-[2px]">
            <Calendar className="h-3 w-3" />
            {formatDateShort(task.dueDate)}
          </Badge>
        )}
        {task.assignees.length > 0 && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1 gap-1 border-none bg-zinc-200/80 dark:bg-zinc-800 text-muted-foreground rounded-[2px]">
            <UsersIcon className="h-3 w-3" />
            {task.assignees.length}
          </Badge>
        )}
      </div>
    </div>
  );
}

interface KanbanColumnProps {
  status: TeamTaskStatus;
  index: number;
  tasks: TeamTask[];
  onDeleteTask: (task: TeamTask) => void;
  onViewTask: (task: TeamTask) => void;
}

function KanbanColumn({ status, index, tasks, onDeleteTask, onViewTask }: KanbanColumnProps) {
  const config = TASK_STATUS_CONFIG[status];
  const StatusIcon = config.icon;
  const [sortOrder, setSortOrder] = useState<'none' | 'high-low' | 'low-high'>('none');

  const columnTasks = useMemo(() => {
    const filtered = tasks.filter((t) => t.status === status);
    if (sortOrder === 'none') return filtered;

    return [...filtered].sort((a, b) => {
      const weightA = PRIORITY_WEIGHT[a.priority];
      const weightB = PRIORITY_WEIGHT[b.priority];
      return sortOrder === 'high-low' ? weightB - weightA : weightA - weightB;
    });
  }, [tasks, status, sortOrder]);

  const handleSortToggle = () => {
    setSortOrder((prev) => {
      if (prev === 'none') return 'high-low';
      if (prev === 'high-low') return 'low-high';
      return 'none';
    });
  };

  const { ref } = useSortable({
    id: status,
    index,
    type: 'column',
    accept: ['item', 'column'],
    collisionPriority: 0
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
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={`h-6 w-6 ${sortOrder !== 'none' ? 'text-primary' : 'text-muted-foreground/60'}`}
            onClick={handleSortToggle}
            title={sortOrder === 'none' ? 'Sort by priority' : sortOrder === 'high-low' ? 'High → Low' : 'Low → High'}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
          <Badge className="text-[11px] font-bold text-muted-foreground bg-zinc-200/50 dark:bg-white/5 px-2 py-0.5 rounded-[2px]">
            {columnTasks.length}
          </Badge>
        </div>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 px-1.5 py-1">
        <div className="space-y-2 min-h-[100px] mb-4">
          {columnTasks.map((task, idx) => (
            <KanbanCard
              key={task.id}
              task={task}
              index={idx}
              onEdit={onViewTask}
              onDelete={onDeleteTask}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// Notes Tab (Sidebar + Editor)
// ============================================================================

interface NotesTabProps {
  teamId: string;
  projectId: string;
  searchQuery: string;
}

function NotesTab({ teamId, projectId, searchQuery }: NotesTabProps) {
  const [selectedNote, setSelectedNote] = useState<TeamNote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: notesData, isLoading } = useTeamNoteList(teamId, projectId);
  const queryClient = useQueryClient();
  const createMutation = useCreateTeamNote(teamId, projectId);
  const updateMutation = useUpdateTeamNote(teamId, projectId);
  const deleteMutation = useDeleteTeamNote(teamId, projectId);

  // Collaboration hooks
  const { data: collabStatus } = useCollaborationStatus();
  const collabAvailable = collabStatus?.available ?? false;
  const documentName = selectedNote
    ? `team-note:${teamId}:${selectedNote.id}`
    : '';
  const collabResult = useCollaborationProvider({
    documentName,
    enabled: collabAvailable && isEditing && !!selectedNote,
  });

  const notes = notesData?.items ?? [];

  // Listen for BroadcastChannel messages from popout windows
  useEffect(() => {
    const channel = new BroadcastChannel('team-note-pip-channel');
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'note-updated') {
        queryClient.invalidateQueries({ queryKey: ['teamNotes'] });
      }
    };
    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
    };
  }, [queryClient]);

  // Filter by search, then sort: pinned first, then by updatedAt desc
  const sortedNotes = useMemo(() => {
    let filtered = notes;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = notes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.createdByEmail?.toLowerCase().includes(q),
      );
    }
    return [...filtered].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [notes, searchQuery]);

  const handleSaveNote = useCallback(
    async (
      id: string | null,
      data: { title: string; content: string; isPinned: boolean }
    ) => {
      const payload: CreateTeamNoteRequest | UpdateTeamNoteRequest = {
        title: data.title,
        content: data.content,
        isPinned: data.isPinned,
      };
      if (id) {
        // Existing note — auto-save, don't exit editing
        const result = await updateMutation.mutateAsync({ noteId: id, payload: payload as UpdateTeamNoteRequest });
        const updatedNote = (result as { note?: TeamNote })?.note;
        if (updatedNote) setSelectedNote(updatedNote);
      } else {
        // New note — create then exit editing
        const result = await createMutation.mutateAsync(payload as CreateTeamNoteRequest);
        const newNote = (result as { note?: TeamNote })?.note;
        if (newNote) setSelectedNote(newNote);
        setIsEditing(false);
      }
    },
    [createMutation, updateMutation]
  );

  const handleDeleteNote = useCallback(async () => {
    if (!deleteNoteId) return;
    try {
      await deleteMutation.mutateAsync(deleteNoteId);
      if (selectedNote?.id === deleteNoteId) {
        setSelectedNote(null);
        setIsEditing(false);
      }
      setDeleteNoteId(null);
      toast.success('Note deleted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete note';
      toast.error(message);
    }
  }, [deleteNoteId, selectedNote, deleteMutation]);

  return (
    <div className="h-full flex gap-0 relative">
      {/* Collapsible sidebar */}
      <div
        data-state={sidebarOpen ? 'expanded' : 'collapsed'}
        className="group/pn-sidebar border rounded-lg flex flex-col shrink-0 overflow-hidden transition-[width] duration-200 ease-linear data-[state=expanded]:w-64 data-[state=collapsed]:w-12"
      >
        {/* Header */}
        <div className="h-10 border-b bg-muted/30 flex items-center shrink-0 px-2 overflow-hidden">
          <h3 className="flex-1 flex items-center gap-1.5 text-sm font-medium whitespace-nowrap truncate min-w-0 transition-all duration-200 ease-linear group-data-[state=collapsed]/pn-sidebar:w-0 group-data-[state=collapsed]/pn-sidebar:opacity-0">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            Notes ({notes.length})
          </h3>
          <div className="flex items-center gap-0.5 shrink-0 transition-all duration-200 ease-linear group-data-[state=collapsed]/pn-sidebar:w-0 group-data-[state=collapsed]/pn-sidebar:opacity-0 group-data-[state=collapsed]/pn-sidebar:overflow-hidden">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                setSelectedNote(null);
                setIsEditing(true);
              }}
              title="New note"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
          </Button>
        </div>

        {/* List */}
        <ScrollArea className="flex-1 w-full min-w-0">
          <div className="flex flex-col gap-1">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {sortedNotes.map((note) => (
              <button
                key={note.id}
                onClick={() => {
                  setSelectedNote(note);
                  setIsEditing(false);
                }}
                className={`flex items-center gap-2 p-2 text-left text-sm transition-all duration-200 ease-linear hover:bg-muted/80 min-h-11 group-data-[state=collapsed]/pn-sidebar:justify-center group-data-[state=collapsed]/pn-sidebar:gap-0 ${
                  selectedNote?.id === note.id ? 'bg-muted' : ''
                }`}
                title={note.title}
              >
                <div className="shrink-0 flex items-center">
                  {note.isPinned ? (
                    <Pin className="h-4 w-4 text-primary" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0 overflow-hidden transition-all duration-200 ease-linear opacity-100 w-full group-data-[state=collapsed]/pn-sidebar:w-0 group-data-[state=collapsed]/pn-sidebar:flex-none group-data-[state=collapsed]/pn-sidebar:opacity-0 group-data-[state=collapsed]/pn-sidebar:max-h-0">
                  <p className="font-medium truncate">{note.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {note.createdByEmail}
                  </p>
                </div>
              </button>
            ))}
            {notes.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 opacity-50" />
                <p className="mt-2 text-xs overflow-hidden transition-all duration-200 ease-linear group-data-[state=collapsed]/pn-sidebar:w-0 group-data-[state=collapsed]/pn-sidebar:opacity-0 group-data-[state=collapsed]/pn-sidebar:h-0">
                  No notes yet
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        {isEditing && collabAvailable && !!selectedNote && !collabResult.provider ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Connecting to collaboration server…</span>
            </div>
          </div>
        ) : isEditing ? (
          <TeamNoteEditor
            key={collabResult.provider ? `collab-${documentName}` : `solo-${selectedNote?.id ?? 'new'}`}
            note={selectedNote}
            teamId={teamId}
            projectId={projectId}
            onSave={handleSaveNote}
            onClose={() => {
              setIsEditing(false);
              if (!selectedNote) setSelectedNote(null);
            }}
            collaboration={
              collabResult.provider
                ? {
                    provider: collabResult.provider,
                    ydoc: collabResult.ydoc,
                    isConnected: collabResult.isConnected,
                    isSynced: collabResult.isSynced,
                    connectedUsers: collabResult.connectedUsers,
                  }
                : undefined
            }
          />
        ) : selectedNote ? (
          <TeamNoteContentViewer
            note={selectedNote}
            onEdit={() => setIsEditing(true)}
            onDelete={(id) => setDeleteNoteId(id)}
            teamId={teamId}
            projectId={projectId}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="h-12 w-12 opacity-50 mb-3" />
            <p className="text-sm">Select a note or create a new one</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteNoteId} onOpenChange={() => setDeleteNoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this note and all revision history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteNote}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Task Form Dialog
// ============================================================================

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TeamTask;
  onSave: (data: CreateTeamTaskRequest | UpdateTeamTaskRequest, id?: string) => Promise<void>;
}

function TaskFormDialog({ open, onOpenChange, task, onSave }: TaskFormDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');        // plain text for NLP parsing
  const [descriptionJson, setDescriptionJson] = useState(''); // Tiptap JSON for persistence
  const [status, setStatus] = useState<TeamTaskStatus>('pending');
  const [priority, setPriority] = useState<TeamTaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // NLP auto-detection state
  const [lastAppliedPriority, setLastAppliedPriority] = useState<string | undefined>(undefined);
  const [lastAppliedDueDate, setLastAppliedDueDate] = useState<string | undefined>(undefined);
  const [userOverridePriority, setUserOverridePriority] = useState(false);
  const [userOverrideDueDate, setUserOverrideDueDate] = useState(false);
  const emptyItems: never[] = [];

  useEffect(() => {
    if (open) {
      if (task) {
        setTitle(task.title);
        setDescription(extractPlainText(task.description ?? ''));
        setDescriptionJson(task.description ?? '');
        setStatus(task.status);
        setPriority(task.priority);
        setDueDate(task.dueDate ?? '');
      } else {
        setTitle('');
        setDescription('');
        setDescriptionJson('');
        setStatus('pending');
        setPriority('medium');
        setDueDate('');
      }
      setLastAppliedPriority(undefined);
      setLastAppliedDueDate(undefined);
      setUserOverridePriority(false);
      setUserOverrideDueDate(false);
    }
  }, [open, task]);

  // NLP auto-detection from description text
  useEffect(() => {
    const timer = setTimeout(() => {
      if (description) {
        const parsed = parseContentForSuggestions(description);

        if (parsed.suggestedPriority) {
          if (!userOverridePriority && parsed.suggestedPriority !== lastAppliedPriority) {
            setPriority(parsed.suggestedPriority as TeamTaskPriority);
            setLastAppliedPriority(parsed.suggestedPriority);
          }
        } else if (lastAppliedPriority) {
          setLastAppliedPriority(undefined);
          setUserOverridePriority(false);
        }

        if (parsed.suggestedDueDate) {
          if (!userOverrideDueDate && parsed.suggestedDueDate !== lastAppliedDueDate) {
            setDueDate(parsed.suggestedDueDate);
            setLastAppliedDueDate(parsed.suggestedDueDate);
          }
        } else if (lastAppliedDueDate) {
          setLastAppliedDueDate(undefined);
          setUserOverrideDueDate(false);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [description, lastAppliedPriority, lastAppliedDueDate, userOverridePriority, userOverrideDueDate]);

  const handlePriorityChange = (v: string) => {
    setPriority(v as TeamTaskPriority);
    setUserOverridePriority(true);
  };

  const handleDueDateChange = (v: string) => {
    setDueDate(v);
    setUserOverrideDueDate(true);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      // Clean description: strip NLP directives from plain text
      const parsed = parseContentForSuggestions(description);
      let finalDescription = descriptionJson;
      // If the description is plain text (not TipTap JSON), use cleaned version
      if (!descriptionJson.startsWith('{"type":"doc"')) {
        finalDescription = parsed.cleanedContent.trim();
      }

      await onSave(
        {
          title: title.trim(),
          description: finalDescription || undefined,
          status,
          priority,
          dueDate: dueDate || undefined,
        },
        task?.id
      );
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create Task'}</DialogTitle>
          <DialogDescription>{task ? 'Update the task details.' : 'Add a new task to this project.'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="taskTitle">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="taskTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taskDescription">Description</Label>
            <MentionTextarea
              placeholder="Describe the task... Type priority: high or due: tomorrow for auto-detection"
              value={descriptionJson}
              onChange={({ text, json }) => {
                setDescription(text);
                setDescriptionJson(JSON.stringify(json));
              }}
              items={emptyItems}
              triggerChar="/"
              minHeight="80px"
              richText
              imageHandler={readFileAsBase64}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TeamTaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_STATUS_CONFIG).map(([s, config]) => (
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
              <Label>Priority</Label>
              <Select value={priority} onValueChange={handlePriorityChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Due Date</Label>
            <DatePicker value={dueDate} onChange={handleDueDateChange} placeholder="Pick date" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim()}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {task ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export const TeamProjectDetailPage = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const teamId = searchParams.get('teamId') ?? '';
  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const [noteSearchQuery, setNoteSearchQuery] = useState('');

  // Real-time SSE for team events
  useTeamEventStream(teamId || undefined);

  // Project data
  const { data: projectData, isLoading, error } = useTeamProjectDetail(teamId, projectId ?? null);
  const project = projectData?.project;

  // Task data (used in both Overview + Tasks tabs)
  const { data: tasksData, isLoading: tasksLoading, refetch: refetchTasks } = useTeamTaskList(
    teamId,
    projectId ?? '',
    { pageSize: 100 }
  );
  const createTaskMutation = useCreateTeamTask(teamId, projectId ?? '');
  const updateTaskMutation = useUpdateTeamTask(teamId, projectId ?? '');
  const deleteTaskMutation = useDeleteTeamTask(teamId, projectId ?? '');

  const allTasks = tasksData?.items ?? [];

  // Local tasks state for DnD optimistic updates
  const [localTasks, setLocalTasks] = useState<TeamTask[]>([]);
  useEffect(() => {
    setLocalTasks(allTasks);
  }, [allTasks]);

  // Task stats computed from actual task data
  const taskStats = useMemo(() => {
    const total = localTasks.length;
    const completed = localTasks.filter((t) => t.status === 'completed').length;
    const inProgress = localTasks.filter((t) => t.status === 'in_progress').length;
    const pending = localTasks.filter((t) => t.status === 'pending').length;
    return { total, completed, inProgress, pending };
  }, [localTasks]);

  const taskProgress = useMemo(() => {
    if (taskStats.total === 0) return 0;
    return Math.round((taskStats.completed / taskStats.total) * 100);
  }, [taskStats]);

  // Dialog states
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | undefined>();
  const [deletingTask, setDeletingTask] = useState<TeamTask | null>(null);
  const [detailTask, setDetailTask] = useState<TeamTask | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const statusConfig = project ? PROJECT_STATUS_CONFIG[project.status] : null;
  const dueInfo = project ? getDaysUntilDue(project.dueDate) : null;

  // Handlers
  const handleSaveTask = useCallback(
    async (data: CreateTeamTaskRequest | UpdateTeamTaskRequest, id?: string) => {
      try {
        if (id) {
          await updateTaskMutation.mutateAsync({ taskId: id, payload: data as UpdateTeamTaskRequest });
          toast.success('Task updated');
        } else {
          await createTaskMutation.mutateAsync(data as CreateTeamTaskRequest);
          toast.success('Task created');
        }
      } catch {
        toast.error('Failed to save task');
        throw new Error('Save failed');
      }
    },
    [updateTaskMutation, createTaskMutation]
  );

  const handleDeleteTask = useCallback(async () => {
    if (!deletingTask) return;
    try {
      await deleteTaskMutation.mutateAsync(deletingTask.id);
      toast.success('Task deleted');
      setDeletingTask(null);
    } catch {
      toast.error('Failed to delete task');
      setDeletingTask(null);
    }
  }, [deletingTask, deleteTaskMutation]);

  const handleEditTask = useCallback((task: TeamTask) => {
    setEditingTask(task);
    setTaskFormOpen(true);
  }, []);

  const handleAddTask = useCallback(() => {
    setEditingTask(undefined);
    setTaskFormOpen(true);
  }, []);

  const handleTaskFormOpenChange = useCallback((open: boolean) => {
    setTaskFormOpen(open);
    if (!open) setEditingTask(undefined);
  }, []);

  const handleViewTask = useCallback((task: TeamTask) => {
    setDetailTask(task);
    setDetailModalOpen(true);
  }, []);

  const handleDetailModalOpenChange = useCallback((open: boolean) => {
    setDetailModalOpen(open);
    if (!open) setDetailTask(null);
  }, []);

  const handleTaskStatusChange = useCallback(
    async (id: string, status: TeamTaskStatus) => {
      try {
        await updateTaskMutation.mutateAsync({ taskId: id, payload: { status } });
        setDetailTask((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
        toast.success('Status updated');
      } catch {
        toast.error('Failed to update status');
      }
    },
    [updateTaskMutation]
  );

  const handleTaskFlagsChange = useCallback(
    async (id: string, flags: TaskUpdateFlag[]) => {
      try {
        await updateTaskMutation.mutateAsync({ taskId: id, payload: { flags } });
        setDetailTask((prev) => (prev && prev.id === id ? { ...prev, flags } : prev));
      } catch {
        toast.error('Failed to update flags');
      }
    },
    [updateTaskMutation]
  );

  const handleDetailEdit = useCallback((task: TeamTask) => {
    setDetailModalOpen(false);
    setDetailTask(null);
    handleEditTask(task);
  }, [handleEditTask]);

  const handleDetailDelete = useCallback((id: string) => {
    const task = localTasks.find((t) => t.id === id);
    if (task) {
      setDetailModalOpen(false);
      setDetailTask(null);
      setDeletingTask(task);
    }
  }, [localTasks]);

  // Error / loading guards
  if (!teamId || !projectId) {
    return (
      <AppPage title="Team Project">
        <div className="flex items-center justify-center p-16">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Missing team or project ID.</AlertDescription>
          </Alert>
        </div>
      </AppPage>
    );
  }

  if (isLoading) {
    return (
      <AppPage title="Team Project">
        <div className="flex items-center justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppPage>
    );
  }

  if (error || !project) {
    return (
      <AppPage title="Team Project">
        <div className="flex flex-col items-center justify-center p-16 gap-4">
          <p className="text-destructive">{error instanceof Error ? error.message : 'Project not found'}</p>
          <Button variant="outline" onClick={() => navigate('/team-projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </AppPage>
    );
  }

  const StatusIcon = statusConfig!.icon;

  return (
    <AppPage
      title={project.title}
      description={project.description || 'Team Project'}
      actions={
        <Button variant="outline" size="sm" onClick={() => navigate('/team-projects')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      }
    >
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
      >
        <AppPageTabs
          tabs={
            <div className="flex items-center justify-between gap-4">
              <TabsList className="h-12 bg-transparent">
              <TabsTrigger value="overview" className="gap-2">
                <FileText className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-2">
                <ListTodo className="h-4 w-4" />
                Tasks
                {taskStats.total > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {taskStats.total}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-2">
                <StickyNote className="h-4 w-4" />
                Notes
              </TabsTrigger>
            </TabsList>
            {activeTab === 'notes' && (
              <div className="relative ml-auto">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={noteSearchQuery}
                  onChange={(e) => setNoteSearchQuery(e.target.value)}
                  placeholder="Search notes..."
                  className="pl-8 w-64 h-8"
                />
              </div>
            )}
            </div>
          }
        >
          {/* Overview Tab */}
          <TabsContent value="overview" className="flex-1 m-0 min-h-0 h-full overflow-auto p-6">
            <div className="grid grid-cols-3 gap-6">
              {/* Main Info */}
              <div className="col-span-2 space-y-6">
                {/* Status & Progress Card */}
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={`${statusConfig!.bgColor} border-0 gap-1 px-3 py-1`}>
                          <StatusIcon className={`h-4 w-4 ${statusConfig!.color}`} />
                          {statusConfig!.label}
                        </Badge>
                        {dueInfo && project.status !== 'completed' && (
                          <span
                            className={`text-sm ${dueInfo.urgent ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
                          >
                            {dueInfo.text}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Task Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Task Progress</span>
                        <span className="font-medium">
                          {taskStats.completed}/{taskStats.total} completed
                        </span>
                      </div>
                      <Progress value={taskProgress} className="h-2" />
                    </div>

                    {/* Task Stats Grid */}
                    <div className="grid grid-cols-4 gap-4 pt-2">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-500">{taskStats.pending}</div>
                        <div className="text-xs text-muted-foreground">Pending</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-500">{taskStats.inProgress}</div>
                        <div className="text-xs text-muted-foreground">In Progress</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-500">{taskStats.completed}</div>
                        <div className="text-xs text-muted-foreground">Completed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{taskStats.total}</div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Description */}
                {project.description && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground whitespace-pre-wrap">{project.description}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Tasks Preview */}
                {localTasks.length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Recent Tasks</CardTitle>
                        <CardDescription>Latest 5 tasks in this project</CardDescription>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setActiveTab('tasks')}>
                        View All
                        <ExternalLink className="h-4 w-4 ml-1" />
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {localTasks.slice(0, 5).map((task) => {
                          const taskConfig = TASK_STATUS_CONFIG[task.status];
                          const TaskIcon = taskConfig.icon;
                          return (
                            <div
                              key={task.id}
                              className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                              onClick={() => handleViewTask(task)}
                            >
                              <TaskIcon className={`h-4 w-4 ${taskConfig.color}`} />
                              <span
                                className={`flex-1 text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}
                              >
                                {task.title.length > 60 ? `${task.title.substring(0, 60)}...` : task.title}
                              </span>
                              <Badge
                                variant={TASK_PRIORITY_CONFIG[task.priority].variant}
                                className="text-xs"
                              >
                                {TASK_PRIORITY_CONFIG[task.priority].label}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Project Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Business IDs */}
                    {project.businessProposalId && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Business Proposal ID</span>
                        </div>
                        <div className="text-sm font-mono font-medium pl-6">
                          {project.businessProposalId}
                        </div>
                      </div>
                    )}

                    {project.changeId && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Change Request ID</span>
                        </div>
                        <div className="text-sm font-mono font-medium pl-6">
                          {project.changeId}
                        </div>
                      </div>
                    )}

                    {/* Dates */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Start Date</span>
                      </div>
                      <div className="text-sm font-medium pl-6">{formatDate(project.startDate)}</div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Due Date</span>
                      </div>
                      <div
                        className={`text-sm font-medium pl-6 ${dueInfo?.urgent && project.status !== 'completed' ? 'text-destructive' : ''}`}
                      >
                        {formatDate(project.dueDate)}
                      </div>
                    </div>

                    {project.actualEndDate && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-muted-foreground">Completed</span>
                        </div>
                        <div className="text-sm font-medium pl-6 text-green-600">
                          {formatDate(project.actualEndDate)}
                        </div>
                      </div>
                    )}

                    {/* Created By */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <UsersIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Created By</span>
                      </div>
                      <div className="text-sm font-medium pl-6">
                        {project.createdByEmail}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Tasks Tab - Kanban Board */}
          <TabsContent value="tasks" className="flex-1 m-0 min-h-0 h-full overflow-auto p-6">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    <strong className="text-foreground">{taskStats.total}</strong> tasks
                  </span>
                  <span className="text-green-500">
                    <strong>{taskStats.completed}</strong> done
                  </span>
                  <span className="text-blue-500">
                    <strong>{taskStats.inProgress}</strong> in progress
                  </span>
                  <span>
                    <strong>{taskStats.pending}</strong> pending
                  </span>
                </div>
                <Button size="sm" onClick={handleAddTask} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Task
                </Button>
              </div>

              {/* Kanban Board */}
              {tasksLoading && (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}

              {!tasksLoading && localTasks.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No tasks yet</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Create tasks to track your team&apos;s work on this project
                    </p>
                    <Button onClick={handleAddTask} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add First Task
                    </Button>
                  </CardContent>
                </Card>
              )}

              {!tasksLoading && localTasks.length > 0 && (
                <DragDropProvider
                  onDragOver={(event) => {
                    const { source, target } = event.operation;
                    if (!source || source.type !== 'item') return;

                    let targetStatus: TeamTaskStatus | undefined;
                    if (target?.type === 'column') {
                      targetStatus = target.id as TeamTaskStatus;
                    } else if (target?.type === 'item') {
                      const targetTask = localTasks.find((t) => t.id === target.id);
                      targetStatus = targetTask?.status;
                    }

                    const sourceTask = localTasks.find((t) => t.id === source.id);
                    if (sourceTask && targetStatus && sourceTask.status !== targetStatus) {
                      setLocalTasks((prev) =>
                        prev.map((t) =>
                          t.id === source.id ? { ...t, status: targetStatus } : t
                        )
                      );
                    }
                  }}
                  onDragEnd={(event) => {
                    const { source, target } = event.operation;
                    if (!source || source.type !== 'item') return;

                    if (event.canceled) {
                      refetchTasks();
                      return;
                    }

                    let targetStatus: TeamTaskStatus | undefined;
                    if (target?.type === 'column') {
                      targetStatus = target.id as TeamTaskStatus;
                    } else if (target?.type === 'item') {
                      const targetTask = localTasks.find((t) => t.id === target.id);
                      targetStatus = targetTask?.status;
                    }

                    if (targetStatus) {
                      const taskId = source.id as string;
                      updateTaskMutation
                        .mutateAsync({ taskId, payload: { status: targetStatus } })
                        .catch(() => {
                          toast.error('Failed to update task status');
                          refetchTasks();
                        });
                    }
                  }}
                >
                  <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
                    {KANBAN_COLUMNS.map((status, index) => (
                      <KanbanColumn
                        key={status}
                        status={status}
                        index={index}
                        tasks={localTasks}
                        onDeleteTask={setDeletingTask}
                        onViewTask={handleViewTask}
                      />
                    ))}
                  </div>
                </DragDropProvider>
              )}
            </div>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="flex-1 m-0 min-h-0 h-full overflow-auto p-6">
            <NotesTab teamId={teamId} projectId={projectId} searchQuery={noteSearchQuery} />
          </TabsContent>
        </AppPageTabs>
      </Tabs>

      {/* Task Detail Modal */}
      <TeamTaskDetailModal
        task={detailTask}
        open={detailModalOpen}
        onOpenChange={handleDetailModalOpenChange}
        onEdit={handleDetailEdit}
        onDelete={handleDetailDelete}
        onStatusChange={handleTaskStatusChange}
        onFlagsChange={handleTaskFlagsChange}
        teamId={teamId}
        projectId={projectId}
      />

      {/* Task Form Dialog */}
      <TaskFormDialog
        open={taskFormOpen}
        onOpenChange={handleTaskFormOpenChange}
        task={editingTask}
        onSave={handleSaveTask}
      />

      {/* Delete Task Confirmation */}
      <AlertDialog open={!!deletingTask} onOpenChange={() => setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deletingTask?.title}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPage>
  );
};
