import {
  AlertCircle,
  Archive,
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  Circle,
  Filter,
  Hash,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import type { TeamProjectStatus, TeamProjectListItem, CreateTeamProjectRequest, UpdateTeamProjectRequest } from '@workspace/shared';

import {
  useTeamProjectList,
  useCreateTeamProject,
  useUpdateTeamProject,
  useDeleteTeamProject
} from '@/features/team-projects';
import { listTeams } from '@/features/teams/api/teams';
import { AppPage, AppPageContent } from '@/components/layout/app-page';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { useMode } from '@/contexts/mode-context';

// ============================================================================
// Types & Constants
// ============================================================================

const STATUS_CONFIG: Record<
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
  project: TeamProjectListItem;
  teamId: string;
  onEdit: (project: TeamProjectListItem) => void;
  onDelete: (project: TeamProjectListItem) => void;
}

function ProjectRow({ project, teamId, onEdit, onDelete }: ProjectRowProps) {
  const statusConfig = STATUS_CONFIG[project.status];
  const StatusIcon = statusConfig.icon;
  const dueInfo = getDaysUntilDue(project.dueDate);
  const navigate = useNavigate();

  return (
    <TableRow className="group">
      <TableCell>
        <div className="flex flex-col gap-1">
          <span
            className="font-medium cursor-pointer text-primary"
            onClick={() => navigate(`/team-projects/${project.id}?teamId=${teamId}`)}
          >
            {project.title}
          </span>
          {project.description && (
            <span className="text-xs text-muted-foreground line-clamp-1">
              {project.description}
            </span>
          )}
          <span className="text-xs text-muted-foreground">by {project.createdByEmail}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`${statusConfig.bgColor} border-0 gap-1`}>
          <StatusIcon className={`h-3 w-3 ${statusConfig.color}`} />
          {statusConfig.label}
        </Badge>
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
        {project.taskStats ? (
          <div className="flex flex-col gap-0.5 text-xs">
            <span>{project.taskStats.total} tasks</span>
            {project.taskStats.completed > 0 && (
              <span className="text-green-600">{project.taskStats.completed} done</span>
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
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(project)}
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

// ============================================================================
// Form Dialog
// ============================================================================

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: TeamProjectListItem;
  onSave: (data: CreateTeamProjectRequest | UpdateTeamProjectRequest, id?: string) => Promise<void>;
}

function ProjectFormDialog({ open, onOpenChange, project, onSave }: ProjectFormDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TeamProjectStatus>('active');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [actualEndDate, setActualEndDate] = useState('');
  const [businessProposalId, setBusinessProposalId] = useState('');
  const [changeId, setChangeId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    if (open) {
      if (project) {
        setTitle(project.title);
        setDescription(project.description ?? '');
        setStatus(project.status);
        setStartDate(project.startDate ?? '');
        setDueDate(project.dueDate ?? '');
        setActualEndDate('');
        setBusinessProposalId(project.businessProposalId ?? '');
        setChangeId(project.changeId ?? '');
      } else {
        setTitle('');
        setDescription('');
        setStatus('active');
        setStartDate('');
        setDueDate('');
        setActualEndDate('');
        setBusinessProposalId('');
        setChangeId('');
      }
      setActiveTab('details');
    }
  }, [open, project]);

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      const data: CreateTeamProjectRequest | UpdateTeamProjectRequest = {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        actualEndDate: actualEndDate || undefined,
        businessProposalId: businessProposalId.trim() || undefined,
        changeId: changeId.trim() || undefined,
      };

      await onSave(data, project?.id);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{project ? 'Edit Project' : 'New Team Project'}</DialogTitle>
          <DialogDescription>
            {project ? 'Update project details and metadata' : 'Create a new collaborative project for your team'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="metadata">Business IDs</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] mt-4 pr-4">
            <TabsContent value="details" className="space-y-4 mt-0 p-2">
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

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TeamProjectStatus)}>
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
            </TabsContent>

            <TabsContent value="metadata" className="space-y-4 mt-0 p-2">
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

// ============================================================================
// Status Filter
// ============================================================================

interface StatusFilterProps {
  selectedStatuses: TeamProjectStatus[];
  onSelectStatuses: (statuses: TeamProjectStatus[]) => void;
}

function StatusFilter({ selectedStatuses, onSelectStatuses }: StatusFilterProps) {
  const toggleStatus = (status: TeamProjectStatus) => {
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
          const status = s as TeamProjectStatus;
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

export const TeamProjectsPage = () => {
  const navigate = useNavigate();
  const { isSoloMode, isSharedMode } = useMode();

  // Team loading state
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TeamProjectStatus[]>([]);

  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<TeamProjectListItem | undefined>();
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<TeamProjectListItem | null>(null);

  // Load user's team
  useEffect(() => {
    if (!isSharedMode) {
      setTeamLoading(false);
      return;
    }

    const loadTeam = async () => {
      try {
        setTeamLoading(true);
        const response = await listTeams();
        if (response.teams.length > 0) {
          setTeamId(response.teams[0].id);
        }
      } catch (err) {
        setTeamError(err instanceof Error ? err.message : 'Failed to load team');
      } finally {
        setTeamLoading(false);
      }
    };

    loadTeam();
  }, [isSharedMode]);

  // Query hooks
  const { data: projectsData, isLoading: projectsLoading, error: projectsError, refetch } = useTeamProjectList(
    teamId ?? '',
    {
      searchQuery: searchQuery || undefined,
      status: statusFilter.length === 1 ? statusFilter[0] : undefined,
    }
  );
  const createMutation = useCreateTeamProject(teamId ?? '');
  const updateMutation = useUpdateTeamProject(teamId ?? '');
  const deleteMutation = useDeleteTeamProject(teamId ?? '');

  const projects = projectsData?.items ?? [];

  // Filtered projects by search and multi-status
  const filteredProjects = useMemo(() => {
    let result = projects;
    if (statusFilter.length > 1) {
      result = result.filter((p) => statusFilter.includes(p.status));
    }
    if (!searchQuery.trim()) return result;
    const query = searchQuery.toLowerCase();
    return result.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.businessProposalId?.toLowerCase().includes(query) ||
        p.changeId?.toLowerCase().includes(query)
    );
  }, [projects, searchQuery, statusFilter]);

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

  const handleEditProject = useCallback((project: TeamProjectListItem) => {
    setEditingProject(project);
    setFormDialogOpen(true);
  }, []);

  const handleFormDialogOpenChange = useCallback((open: boolean) => {
    setFormDialogOpen(open);
    if (!open) {
      setEditingProject(undefined);
    }
  }, []);

  const handleSaveProject = useCallback(
    async (data: CreateTeamProjectRequest | UpdateTeamProjectRequest, id?: string) => {
      try {
        if (id) {
          await updateMutation.mutateAsync({ projectId: id, payload: data as UpdateTeamProjectRequest });
          toast.success('Project updated');
        } else {
          await createMutation.mutateAsync(data as CreateTeamProjectRequest);
          toast.success('Project created');
        }
      } catch {
        toast.error('Failed to save project');
        throw new Error('Save failed');
      }
    },
    [updateMutation, createMutation]
  );

  const handleDeleteProject = useCallback(async () => {
    if (!deleteConfirmProject) return;

    try {
      await deleteMutation.mutateAsync(deleteConfirmProject.id);
      toast.success('Project deleted');
      setDeleteConfirmProject(null);
    } catch {
      toast.error('Failed to delete project');
      setDeleteConfirmProject(null);
    }
  }, [deleteConfirmProject, deleteMutation]);

  // Solo mode placeholder
  if (isSoloMode) {
    return (
      <AppPage title="Team Projects">
        <AppPageContent>
          <div className="flex items-center justify-center p-16">
            <Card className="max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Team Feature</CardTitle>
                <CardDescription>
                  Team Projects require a shared database connection. Configure it in Settings to unlock collaborative features.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </AppPageContent>
      </AppPage>
    );
  }

  if (teamLoading) {
    return (
      <AppPage title="Team Projects">
        <AppPageContent>
          <div className="flex items-center justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </AppPageContent>
      </AppPage>
    );
  }

  if (teamError) {
    return (
      <AppPage title="Team Projects">
        <AppPageContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{teamError}</AlertDescription>
          </Alert>
        </AppPageContent>
      </AppPage>
    );
  }

  if (!teamId) {
    return (
      <AppPage title="Team Projects">
        <AppPageContent>
          <div className="flex items-center justify-center p-16">
            <Card className="max-w-md">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>No Team</CardTitle>
                <CardDescription>
                  You need to join or create a team first. Go to the Teams page to get started.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button onClick={() => navigate('/teams')}>Go to Teams</Button>
              </CardContent>
            </Card>
          </div>
        </AppPageContent>
      </AppPage>
    );
  }

  const error = projectsError ? (projectsError instanceof Error ? projectsError.message : 'Failed to load projects') : null;

  return (
    <AppPage
      title="Team Projects"
      description="Manage collaborative projects shared with your team"
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
        {projectsLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-12 text-destructive">
            <p>{error}</p>
            <Button variant="outline" onClick={() => refetch()} className="mt-4">
              Retry
            </Button>
          </div>
        )}

        {!projectsLoading && !error && filteredProjects.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No projects found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchQuery || statusFilter.length > 0
                  ? 'Try adjusting your filters or search query'
                  : 'Get started by creating your first team project'}
              </p>
              {!searchQuery && statusFilter.length === 0 && (
                <Button onClick={handleAddProject} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Project
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {!projectsLoading && !error && filteredProjects.length > 0 && (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Project</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[130px]">Business IDs</TableHead>
                  <TableHead className="w-[180px]">Dates</TableHead>
                  <TableHead className="w-[100px]">Tasks</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    teamId={teamId}
                    onEdit={handleEditProject}
                    onDelete={setDeleteConfirmProject}
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
        onOpenChange={handleFormDialogOpenChange}
        project={editingProject}
        onSave={handleSaveProject}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmProject} onOpenChange={() => setDeleteConfirmProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteConfirmProject?.title}&quot; and all its notes and tasks.
              This action cannot be undone.
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
};
