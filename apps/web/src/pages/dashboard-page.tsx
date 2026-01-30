import {
  CheckCircle2,
  DollarSign,
  Flame,
  Loader2,
  Plus,
  StickyNote,
  Zap
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { Note, OvertimeStatistics, PersonalProject, WorkLogEntry } from '@workspace/shared';

import { ProductivityHeatmapCard } from '@/components/dashboard/productivity-heatmap-card';
import { personalProjectsApi, workLogsApi } from '@/api/journal';
import { notesApi } from '@/api/notes-vault';
import { toolsApi } from '@/api/tools';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export const DashboardPage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  // Data State
  const [stats, setStats] = useState<{
    overtime: OvertimeStatistics | null;
    completedTasksWeek: number;
    activeTasksCount: number;
    streak: number;
  }>({ overtime: null, completedTasksWeek: 0, activeTasksCount: 0, streak: 0 });

  const [activeTasks, setActiveTasks] = useState<WorkLogEntry[]>([]);
  const [historyLogs, setHistoryLogs] = useState<WorkLogEntry[]>([]);
  const [activeProjects, setActiveProjects] = useState<PersonalProject[]>([]);
  const [pinnedNotes, setPinnedNotes] = useState<Note[]>([]);
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);

  // Quick Capture State
  const [quickCaptureText, setQuickCaptureText] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Calculate start of week (Monday)
      const dist = today.getDay() === 0 ? 6 : today.getDay() - 1;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - dist);
      const weekStartStr = weekStart.toISOString().split('T')[0];

      // Calculate 60 days ago for Recent Activity & Stats
      const sixtyDaysAgo = new Date(today);
      sixtyDaysAgo.setDate(today.getDate() - 60);
      const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];

      // Calculate start of month for Overtime
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split('T')[0];

      const [
        activeTasksRes,
        historyRes,
        activeProjectsRes,
        notesRes,
        overtimeStatsRes
      ] = await Promise.all([
        // Active Tasks (Todo/InProgress)
        workLogsApi.list({ status: ['todo', 'in_progress'] }),
        // Recent History (Last 60 days) for Stats/Recents
        workLogsApi.list({ from: sixtyDaysAgoStr }),
        // Active Projects
        personalProjectsApi.list({ status: ['active'] }),
        // All Notes
        notesApi.list(),
        // Overtime Stats (Current Month)
        toolsApi.getOvertimeStatistics({ from: monthStartStr })
      ]);

      const historyItems = historyRes.items;
      const notesItems = notesRes.items;

      setActiveTasks(activeTasksRes.items.slice(0, 5)); // Top 5 active
      setHistoryLogs(historyItems);
      setActiveProjects(activeProjectsRes.items.slice(0, 4));
      setPinnedNotes(notesItems.filter(n => n.isPinned).slice(0, 4));
      setRecentNotes(notesItems.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5));

      // Calculate Stats
      const weekLogs = historyItems.filter(l => l.date >= weekStartStr && l.status === 'done');

      // Calculate Streak
      // Get unique dates with activities in history
      const activityDates = new Set(historyItems.map(l => l.date));
      let currentStreak = 0;
      let checkDate = new Date(today);

      // If no activity today, check yesterday to start streak counting?
      if (!activityDates.has(todayStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      while (true) {
        const checkStr = checkDate.toISOString().split('T')[0];
        if (activityDates.has(checkStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      setStats({
        overtime: overtimeStatsRes,
        completedTasksWeek: weekLogs.length,
        activeTasksCount: activeTasksRes.items.length,
        streak: currentStreak
      });

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleQuickCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCaptureText.trim()) return;

    setIsCapturing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await workLogsApi.create({
        date: today,
        content: quickCaptureText,
        status: 'todo',
        priority: 'medium'
      });
      setQuickCaptureText('');
      // Refresh only active tasks to be fast
      const res = await workLogsApi.list({ status: ['todo', 'in_progress'] });
      setActiveTasks(res.items.slice(0, 5));
      setStats(prev => ({ ...prev, activeTasksCount: res.items.length }));
    } catch (err) {
      console.error('Quick capture failed:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">

      {/* 0. Header & Quick Capture */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your workspace productivity.</p>
        </div>
        <form onSubmit={handleQuickCapture} className="flex w-full md:w-auto items-center gap-2">
          <Input
            placeholder="Quick capture task..."
            value={quickCaptureText}
            onChange={(e) => setQuickCaptureText(e.target.value)}
            className="w-full md:w-[300px]"
            disabled={isCapturing}
          />
          <Button type="submit" size="icon" disabled={isCapturing || !quickCaptureText.trim()}>
            {isCapturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </form>
      </div>

      {/* 1. Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Overtime</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.overtime?.totalPay ?? 0)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.overtime?.totalHours} hours recorded this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedTasksWeek}</div>
            <p className="text-xs text-muted-foreground">
              Completed this week
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Focus</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeTasksCount}</div>
            <p className="text-xs text-muted-foreground">
              Tasks pending or in-progress
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Flame className={cn("h-4 w-4", stats.streak > 0 ? "text-orange-500 fill-orange-500" : "text-muted-foreground")} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.streak} Days</div>
            <p className="text-xs text-muted-foreground">
              Consecutive days active
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">

        {/* Main Column */}
        <div className="col-span-4 space-y-6">

          {/* 2. Productivity Heatmap */}
          <ProductivityHeatmapCard />

          {/* 3. Active Focus */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Active Focus</CardTitle>
                <CardDescription>
                  Tasks that need your attention today
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => navigate('/journal')}>
                View Journal
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mb-2 opacity-50" />
                    <p>All caught up!</p>
                    <Button variant="link" onClick={() => navigate('/journal')} className="mt-2">Add a task</Button>
                  </div>
                ) : (
                  activeTasks.map((task) => (
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
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side Column */}
        <div className="col-span-3 space-y-4">

          {/* 4. Projects Watchlist */}
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
              {activeProjects.length === 0 ? (
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

          {/* 5. Recent Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentActivityList historyLogs={historyLogs} recentNotes={recentNotes} />
            </CardContent>
          </Card>

          {/* 6. Pinned Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pinned Notes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {pinnedNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pinned notes.</p>
              ) : (
                pinnedNotes.map((note) => (
                  <div key={note.id} className="flex items-start gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate('/notes')}>
                    <StickyNote className="h-4 w-4 mt-0.5 text-yellow-500 shrink-0" />
                    <div className="space-y-1 overflow-hidden">
                      <p className="text-sm font-medium leading-none truncate">{note.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{note.content}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// --- Sub-components ---

const RecentActivityList = ({ historyLogs, recentNotes }: { historyLogs: WorkLogEntry[], recentNotes: Note[]; }) => {
  // Combine and sort top 5 most recent items
  const items = useMemo(() => {
    const tasks = historyLogs.filter(l => l.status === 'done').map(l => ({
      type: 'task' as const,
      id: l.id,
      date: l.updatedAt, // or actualEndDate? normalized
      title: l.content,
      meta: l.date // completion date
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
  }, [historyLogs, recentNotes]);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No recent activity.</p>;
  }

  return (
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
  );
};


function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-10 w-[300px]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[60px] mb-2" />
              <Skeleton className="h-3 w-[140px]" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 space-y-6">
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
        </div>
        <div className="col-span-3 space-y-4">
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
