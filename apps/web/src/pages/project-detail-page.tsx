import {
  Archive,
  ArrowLeft,
  Calendar,
  Check,
  Circle,
  Clock,
  ExternalLink,
  FileText,
  FolderOpen,
  Hash,
  ListTodo,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Plus,
  StickyNote,
  Tag as TagIcon,
  Trash2
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import type {
  PersonalProjectDetail,
  PersonalProjectStatus,
  WorkLogEntry,
  WorkLogStatus
} from '@workspace/shared';

import {
  personalProjectsApi,
  workLogsApi,
  type CreateWorkLogRequest
} from '@/api/journal';
import { ProjectNotesPanel } from '@/components/notes/project-notes-panel';
import { WorkspaceFilesTab } from '@/features/workspaces/components/workspace-project-tab';
import { AppPage, AppPageContent, AppPageTabs } from '@/components/layout/app-page';
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
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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

type TabValue = 'overview' | 'tasks' | 'notes' | 'files';

const PROJECT_STATUS_CONFIG: Record<
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

const TASK_STATUS_CONFIG: Record<
  WorkLogStatus,
  { label: string; icon: typeof Circle; color: string; bgColor: string }
> = {
  todo: {
    label: 'To Do',
    icon: Circle,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30'
  },
  in_progress: {
    label: 'In Progress',
    icon: Clock,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30'
  },
  done: {
    label: 'Done',
    icon: Check,
    color: 'text-green-500',
    bgColor: 'bg-green-100 dark:bg-green-900/30'
  },
  blocked: {
    label: 'Blocked',
    icon: Pause,
    color: 'text-red-500',
    bgColor: 'bg-red-100 dark:bg-red-900/30'
  }
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

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  return formatDate(dateStr);
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

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// ============================================================================
// Sub-Components
// ============================================================================

interface TaskRowProps {
  task: WorkLogEntry;
  onStatusChange: (id: string, status: WorkLogStatus) => void;
  onDelete: (id: string) => void;
  onViewInJournal: (date: string) => void;
}

function TaskRow({ task, onStatusChange, onDelete, onViewInJournal }: TaskRowProps) {
  const statusConfig = TASK_STATUS_CONFIG[task.status];
  const StatusIcon = statusConfig.icon;
  const dueInfo = getDaysUntilDue(task.dueDate);

  return (
    <TableRow className="group">
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className={`font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
            {task.content.length > 80 ? `${task.content.substring(0, 80)}...` : task.content}
          </span>
          <span className="text-xs text-muted-foreground">
            Journal: {formatRelativeDate(task.date)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Select value={task.status} onValueChange={(v) => onStatusChange(task.id, v as WorkLogStatus)}>
          <SelectTrigger className="w-32 h-8 pl-2">
            <Badge variant="outline" className={`${statusConfig.bgColor} border-0 gap-2`}>
              <StatusIcon className={`h-3 w-3 ${statusConfig.color}`} />
              {statusConfig.label}
            </Badge>
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
      </TableCell>
      <TableCell>
        {task.priority && (
          <Badge
            variant={
              task.priority === 'high' 
                ? 'destructive' 
                : task.priority === 'medium' 
                  ? 'warning' 
                  : 'secondary'
            }
          >
            {task.priority}
          </Badge>
        )}
        {!task.priority && <span className="text-muted-foreground text-sm">-</span>}
      </TableCell>
      <TableCell>
        {task.dueDate ? (
          <span
            className={`text-sm ${dueInfo?.urgent && task.status !== 'done' ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
          >
            {formatDate(task.dueDate)}
            {dueInfo && task.status !== 'done' && (
              <span className="block text-xs">({dueInfo.text})</span>
            )}
          </span>
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
            <DropdownMenuItem onClick={() => onViewInJournal(task.date)}>
              <Calendar className="h-4 w-4 mr-2" />
              View in Journal
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(task.id)}
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

interface QuickTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onCreated: () => void;
}

function QuickTaskDialog({ open, onOpenChange, projectId, onCreated }: QuickTaskDialogProps) {
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setContent('');
      setPriority('');
      setDueDate('');
    }
  }, [open]);

  const handleSave = async () => {
    if (!content.trim()) return;

    setIsSaving(true);
    try {
      const data: CreateWorkLogRequest = {
        date: getTodayDate(),
        content: content.trim(),
        status: 'todo',
        priority: priority || undefined,
        dueDate: dueDate || undefined,
        projectId
      };
      await workLogsApi.create(data);
      onCreated();
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
          <DialogDescription>
            Create a new task linked to this project. It will also appear in your Journal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="task-content">
              Task Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="task-content"
              placeholder="What needs to be done?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as 'low' | 'medium' | 'high')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <DatePicker value={dueDate} onChange={setDueDate} placeholder="Pick date" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !content.trim()}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [project, setProject] = useState<PersonalProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>(
    (searchParams.get('tab') as TabValue) || 'overview'
  );

  // Dialog states
  const [quickTaskOpen, setQuickTaskOpen] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  // Fetch project data
  const fetchProject = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await personalProjectsApi.getDetail(projectId);
      setProject(response.project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Computed values
  const statusConfig = project ? PROJECT_STATUS_CONFIG[project.status] : null;
  const dueInfo = project ? getDaysUntilDue(project.dueDate) : null;

  const taskProgress = useMemo(() => {
    if (!project || project.taskStats.total === 0) return 0;
    return Math.round((project.taskStats.done / project.taskStats.total) * 100);
  }, [project]);

  // Handlers
  const handleTaskStatusChange = async (taskId: string, newStatus: WorkLogStatus) => {
    try {
      await workLogsApi.update(taskId, { status: newStatus });
      fetchProject();
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteTaskId) return;

    try {
      await workLogsApi.delete(deleteTaskId);
      fetchProject();
    } finally {
      setDeleteTaskId(null);
    }
  };

  const handleViewInJournal = (date: string) => {
    navigate(`/journal?date=${date}`);
  };

  const handleGoToWorkspace = () => {
    if (project?.linkedWorkspace) {
      navigate(`/workspaces/${project.linkedWorkspace.id}`);
    }
  };

  const handleEditProject = () => {
    navigate(`/projects?edit=${projectId}`);
  };

  // Loading & Error states
  if (isLoading) {
    return (
      <AppPage title="Loading..." description="Loading project details...">
        <AppPageContent className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </AppPageContent>
      </AppPage>
    );
  }

  if (error || !project) {
    return (
      <AppPage title="Error" description={error ?? 'Project not found'}>
        <AppPageContent className="flex flex-col items-center justify-center gap-4">
          <p className="text-destructive">{error ?? 'Project not found'}</p>
          <Button variant="outline" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </AppPageContent>
      </AppPage>
    );
  }

  const StatusIcon = statusConfig!.icon;

  return (
    <AppPage
      title={project.title}
      description={project.description || 'Personal Project'}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" size="sm" onClick={handleEditProject}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      }
    >
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
        className="flex-1 flex flex-col"
      >
        <AppPageTabs
          tabs={
            <TabsList className="h-12 bg-transparent">
              <TabsTrigger value="overview" className="gap-2">
                <FileText className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-2">
                <ListTodo className="h-4 w-4" />
                Tasks
                {project.taskStats.total > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {project.taskStats.total}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-2">
                <FolderOpen className="h-4 w-4" />
                Files
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-2">
                <StickyNote className="h-4 w-4" />
                Notes
                {project.notes && (
                  <span className="ml-1 h-2 w-2 rounded-full bg-primary" />
                )}
              </TabsTrigger>
            </TabsList>
          }
        >
          {/* Overview Tab */}
          <TabsContent value="overview" className="flex-1 m-0 overflow-auto p-6">
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
                          {project.taskStats.done}/{project.taskStats.total} completed
                        </span>
                      </div>
                      <Progress value={taskProgress} className="h-2" />
                    </div>

                    {/* Task Stats */}
                    <div className="grid grid-cols-4 gap-4 pt-2">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-500">{project.taskStats.todo}</div>
                        <div className="text-xs text-muted-foreground">To Do</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-500">{project.taskStats.inProgress}</div>
                        <div className="text-xs text-muted-foreground">In Progress</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-500">{project.taskStats.done}</div>
                        <div className="text-xs text-muted-foreground">Done</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-500">{project.taskStats.blocked}</div>
                        <div className="text-xs text-muted-foreground">Blocked</div>
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
                {project.linkedTasks.length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Recent Tasks</CardTitle>
                        <CardDescription>Latest 5 tasks linked to this project</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab('tasks')}
                      >
                        View All
                        <ExternalLink className="h-4 w-4 ml-1" />
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {project.linkedTasks.slice(0, 5).map((task) => {
                          const taskConfig = TASK_STATUS_CONFIG[task.status];
                          const TaskIcon = taskConfig.icon;
                          return (
                            <div
                              key={task.id}
                              className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50"
                            >
                              <TaskIcon className={`h-4 w-4 ${taskConfig.color}`} />
                              <span
                                className={`flex-1 text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}
                              >
                                {task.content.length > 60
                                  ? `${task.content.substring(0, 60)}...`
                                  : task.content}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeDate(task.date)}
                              </span>
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
                  </CardContent>
                </Card>

                {/* Linked Workspace */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Workspace</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {project.linkedWorkspace ? (
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-2"
                        onClick={handleGoToWorkspace}
                      >
                        <FolderOpen className="h-4 w-4" />
                        {project.linkedWorkspace.name}
                        <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground">No workspace linked</p>
                    )}
                  </CardContent>
                </Card>

                {/* Tags */}
                {project.tags.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tags</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {project.tags.map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            style={tag.color ? { backgroundColor: `${tag.color}20` } : undefined}
                          >
                            <TagIcon className="h-3 w-3 mr-1" />
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="flex-1 m-0 overflow-auto p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Tasks</h3>
                  <p className="text-sm text-muted-foreground">
                    Work journal entries linked to this project
                  </p>
                </div>
                <Button size="sm" onClick={() => setQuickTaskOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </div>

              {project.linkedTasks.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No tasks yet</h3>
                    <p className="text-muted-foreground text-center mb-4 max-w-md">
                      Add tasks to track your progress. Tasks also appear in your Work Journal.
                    </p>
                    <Button onClick={() => setQuickTaskOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add First Task
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-100">Task</TableHead>
                        <TableHead className="w-35">Status</TableHead>
                        <TableHead className="w-25">Priority</TableHead>
                        <TableHead className="w-40">Due Date</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {project.linkedTasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          onStatusChange={handleTaskStatusChange}
                          onDelete={setDeleteTaskId}
                          onViewInJournal={handleViewInJournal}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="flex-1 m-0 overflow-auto p-6">
            {(project.linkedWorkspace || project.folderPath) ? (
              <WorkspaceFilesTab 
                workspaceId={project.linkedWorkspace?.id ?? 'standalone'} 
                customRootPath={project.folderPath}
              />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Files Linked</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Link this project to a workspace OR a local folder to manage files.
                  </p>
                  <Button variant="outline" onClick={() => navigate(`/projects?edit=${project.id}`)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Project Configuration
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="flex-1 m-0 overflow-auto p-6">
            <ProjectNotesPanel projectId={project.id} />
          </TabsContent>
        </AppPageTabs>
      </Tabs>

      {/* Quick Task Dialog */}
      <QuickTaskDialog
        open={quickTaskOpen}
        onOpenChange={setQuickTaskOpen}
        projectId={project.id}
        onCreated={fetchProject}
      />

      {/* Delete Task Confirmation */}
      <AlertDialog open={!!deleteTaskId} onOpenChange={() => setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This will also remove it from your Work
              Journal.
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
}
