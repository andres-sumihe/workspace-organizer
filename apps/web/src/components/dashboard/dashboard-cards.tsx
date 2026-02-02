import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Plus, StickyNote } from 'lucide-react';

import { personalProjectsApi, workLogsApi } from '@/api/journal';
import { notesApi } from '@/api/notes-vault';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/query-client';

const STALE_TIME = 2 * 60 * 1000; // 2 minutes

// ============================================================================
// Active Focus Tasks List Card
// ============================================================================
export const ActiveFocusCard = () => {
  const navigate = useNavigate();

  const { data: activeTasksRes, isLoading } = useQuery({
    queryKey: queryKeys.workLogs.list({ status: ['todo', 'in_progress'] }),
    queryFn: () => workLogsApi.list({ status: ['todo', 'in_progress'] }),
    staleTime: STALE_TIME,
    placeholderData: (prev) => prev,
  });

  const activeTasks = useMemo(() => activeTasksRes?.items.slice(0, 5) ?? [], [activeTasksRes]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Active Focus</CardTitle>
          <CardDescription>Tasks that need your attention today</CardDescription>
        </div>
        <Button size="sm" onClick={() => navigate('/journal')}>
          View Journal
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && !activeTasksRes ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between space-x-4 border-b pb-4 last:border-0">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mb-2 opacity-50" />
            <p>All caught up!</p>
            <Button variant="link" onClick={() => navigate('/journal')} className="mt-2">Add a task</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between space-x-4 border-b pb-4 last:border-0 last:pb-0">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{task.content}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={task.status === 'in_progress' ? 'default' : 'secondary'} className="text-[10px] h-5 px-1.5">
                      {task.status.replace('_', ' ')}
                    </Badge>
                    {task.priority === 'high' && <Badge variant="destructive" className="text-[10px] h-5 px-1.5">high</Badge>}
                    {task.dueDate && <span>Due: {task.dueDate}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Projects Watchlist Card
// ============================================================================
export const ProjectsWatchlistCard = () => {
  const navigate = useNavigate();

  const { data: activeProjectsRes, isLoading } = useQuery({
    queryKey: queryKeys.personalProjects.list({ status: ['active'] }),
    queryFn: () => personalProjectsApi.list({ status: ['active'] }),
    staleTime: STALE_TIME,
    placeholderData: (prev) => prev,
  });

  const activeProjects = useMemo(() => activeProjectsRes?.items.slice(0, 4) ?? [], [activeProjectsRes]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Projects Watchlist</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {isLoading && !activeProjectsRes ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-2 w-1/2" />
              </div>
            </div>
          ))
        ) : activeProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active projects.</p>
        ) : (
          activeProjects.map((project) => (
            <div key={project.id} className="flex items-center justify-between space-x-4 cursor-pointer hover:bg-muted/50 p-2 rounded-md -mx-2 transition-colors" onClick={() => navigate(`/projects/${project.id}`)}>
              <div className="flex items-center space-x-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{project.title}</p>
                  <div className="flex items-center gap-2">
                    <Progress value={33} className="h-1 w-16" />
                    <span className="text-xs text-muted-foreground">Active</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Recent Activity Card
// ============================================================================
export const RecentActivityCard = () => {
  const sixtyDaysAgoStr = useMemo(() => {
    const now = new Date();
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(now.getDate() - 60);
    return sixtyDaysAgo.toISOString().split('T')[0];
  }, []);

  const { data: historyRes, isLoading: isLoadingHistory } = useQuery({
    queryKey: queryKeys.workLogs.list({ from: sixtyDaysAgoStr }),
    queryFn: () => workLogsApi.list({ from: sixtyDaysAgoStr }),
    staleTime: STALE_TIME,
    placeholderData: (prev) => prev,
  });

  const { data: notesRes, isLoading: isLoadingNotes } = useQuery({
    queryKey: queryKeys.notes.list(),
    queryFn: () => notesApi.list(),
    staleTime: STALE_TIME,
    placeholderData: (prev) => prev,
  });

  const isLoading = (isLoadingHistory && !historyRes) || (isLoadingNotes && !notesRes);

  const items = useMemo(() => {
    const historyLogs = historyRes?.items ?? [];
    const recentNotes = notesRes?.items 
      ? [...notesRes.items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5)
      : [];

    const tasks = historyLogs.filter(l => l.status === 'done').map(l => ({
      type: 'task' as const,
      id: l.id,
      date: l.updatedAt,
      title: l.content,
      meta: l.date
    }));
    const notes = recentNotes.map(n => ({
      type: 'note' as const,
      id: n.id,
      date: n.updatedAt,
      title: n.title,
      meta: 'Note'
    }));

    return [...tasks, ...notes]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [historyRes, notesRes]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-2 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <div key={`${item.type}-${item.id}`} className="flex items-center gap-3">
                <div className={cn("p-1.5 rounded-full shrink-0", item.type === 'task' ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400")}>
                  {item.type === 'task' ? <CheckCircle2 className="h-3 w-3" /> : <StickyNote className="h-3 w-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground">{item.type === 'task' ? `Completed ${item.meta}` : `Edited ${new Date(item.date).toLocaleDateString()}`}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Pinned Notes Card
// ============================================================================
export const PinnedNotesCard = () => {
  const navigate = useNavigate();

  const { data: notesRes, isLoading } = useQuery({
    queryKey: queryKeys.notes.list(),
    queryFn: () => notesApi.list(),
    staleTime: STALE_TIME,
    placeholderData: (prev) => prev,
  });

  const pinnedNotes = useMemo(() => {
    if (!notesRes?.items) return [];
    return notesRes.items.filter(n => n.isPinned).slice(0, 4);
  }, [notesRes]);

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Pinned Notes</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 overflow-hidden">
        {isLoading && !notesRes ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start gap-2 p-2 border rounded-md">
              <Skeleton className="h-4 w-4 shrink-0" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))
        ) : pinnedNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pinned notes.</p>
        ) : (
          pinnedNotes.map((note) => (
            <div key={note.id} className="flex items-start gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors min-w-0" onClick={() => navigate(`/notes?noteId=${note.id}`)}>
              <StickyNote className="h-4 w-4 mt-0.5 text-yellow-500 shrink-0" />
              <div className="space-y-1 overflow-hidden min-w-0 flex-1">
                <p className="text-sm font-medium leading-none truncate">{note.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 break-words">{note.content}</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
