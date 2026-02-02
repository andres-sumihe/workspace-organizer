import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { workLogsApi } from '@/api/journal';
import { ProductivityHeatmapCard } from '@/components/dashboard/productivity-heatmap-card';
import {
  OvertimeStatCard,
  TasksCompletedCard,
  ActiveFocusCountCard,
  StreakCard,
} from '@/components/dashboard/stats-cards';
import {
  ActiveFocusCard,
  ProjectsWatchlistCard,
  RecentActivityCard,
  PinnedNotesCard,
} from '@/components/dashboard/dashboard-cards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { queryKeys } from '@/lib/query-client';

export const DashboardPage = () => {
  const queryClient = useQueryClient();

  // Quick Capture State
  const [quickCaptureText, setQuickCaptureText] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

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
        priority: 'medium',
      });
      setQuickCaptureText('');

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.all });
    } catch (err) {
      console.error('Quick capture failed:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 0. Header & Quick Capture */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your workspace productivity.
          </p>
        </div>
        <form
          onSubmit={handleQuickCapture}
          className="flex w-full md:w-auto items-center gap-2"
        >
          <Input
            placeholder="Quick capture task..."
            value={quickCaptureText}
            onChange={(e) => setQuickCaptureText(e.target.value)}
            className="w-full md:w-[300px]"
            disabled={isCapturing}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isCapturing || !quickCaptureText.trim()}
          >
            {isCapturing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>

      {/* 1. Stats Overview - Each card fetches its own data */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <OvertimeStatCard />
        <TasksCompletedCard />
        <ActiveFocusCountCard />
        <StreakCard />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Main Column */}
        <div className="col-span-4 space-y-6">
          {/* 2. Productivity Heatmap */}
          <ProductivityHeatmapCard />

          {/* 3. Active Focus */}
          <ActiveFocusCard />
        </div>

        {/* Side Column */}
        <div className="col-span-3 space-y-4 min-w-0 overflow-hidden">
          {/* 4. Projects Watchlist */}
          <ProjectsWatchlistCard />

          {/* 5. Recent Activity */}
          <RecentActivityCard />

          {/* 6. Pinned Notes */}
          <PinnedNotesCard />
        </div>
      </div>
    </div>
  );
};
