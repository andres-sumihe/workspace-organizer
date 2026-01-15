import {
  Archive,
  Briefcase,
  Calendar,
  Check,
  Circle,
  ExternalLink,
  Loader2,
  Pause,
  Plus
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { PersonalProject, PersonalProjectStatus } from '@workspace/shared';

import { personalProjectsApi } from '@/api/journal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

// ============================================================================
// Types & Constants
// ============================================================================

interface WorkspaceLinkedProjectsTabProps {
  workspaceId: string;
}

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
// Helper Functions
// ============================================================================

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
// Main Component
// ============================================================================

export function WorkspaceLinkedProjectsTab({ workspaceId }: WorkspaceLinkedProjectsTabProps) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<PersonalProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await personalProjectsApi.list({ workspaceId });
      setProjects(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = () => {
    navigate(`/projects?workspaceId=${workspaceId}`);
  };

  const handleOpenProject = (projectId: string) => {
    navigate(`/projects?workspaceId=${workspaceId}&highlight=${projectId}`);
  };

  const handleViewAllProjects = () => {
    navigate(`/projects?workspaceId=${workspaceId}`);
  };

  // Stats
  const stats = {
    total: projects.length,
    active: projects.filter((p) => p.status === 'active').length,
    completed: projects.filter((p) => p.status === 'completed').length,
    overdue: projects.filter((p) => {
      if (!p.dueDate || p.status === 'completed') return false;
      const due = new Date(p.dueDate);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);
      return due < now;
    }).length
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-destructive">
        <p>{error}</p>
        <Button variant="outline" onClick={fetchProjects} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Linked Projects</h3>
          <p className="text-sm text-muted-foreground">
            Projects associated with this workspace
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleViewAllProjects}>
            <ExternalLink className="h-4 w-4 mr-2" />
            View All in Projects
          </Button>
          <Button size="sm" onClick={handleCreateProject}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
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
              <Calendar className="h-3 w-3 text-destructive" /> Overdue
            </CardDescription>
            <CardTitle className="text-2xl text-destructive">{stats.overdue}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Projects Table or Empty State */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No linked projects</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-md">
              Create a project and link it to this workspace to track your initiatives,
              deadlines, and business metadata.
            </p>
            <Button onClick={handleCreateProject} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Project</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[150px]">Business IDs</TableHead>
                <TableHead className="w-[200px]">Dates</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => {
                const statusConfig = STATUS_CONFIG[project.status];
                const StatusIcon = statusConfig.icon;
                const dueInfo = getDaysUntilDue(project.dueDate);

                return (
                  <TableRow key={project.id} className="group">
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{project.title}</span>
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
                          <span
                            className={`text-xs ${
                              dueInfo?.urgent ? 'text-destructive font-medium' : 'text-muted-foreground'
                            }`}
                          >
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenProject(project.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
