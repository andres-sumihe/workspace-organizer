import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';

import { AppPage, AppPageContent } from '@/components/layout/app-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ActiveFocusCard,
  ProjectsWatchlistCard,
  RecentActivityCard,
  PinnedNotesCard,
} from '@/features/dashboard/components/dashboard-cards';
import { ProductivityHeatmapCard } from '@/features/dashboard/components/productivity-heatmap-card';
import {
  OvertimeStatCard,
  TasksCompletedCard,
  ActiveFocusCountCard,
  StreakCard,
} from '@/features/dashboard/components/stats-cards';
import { workLogsApi } from '@/features/journal/api/journal';
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
    <AppPage
      title="Dashboard"
      description="Overview of your workspace productivity."
      actions={
        <form onSubmit={handleQuickCapture} className="flex items-center gap-2">
          <Input
            placeholder="Quick capture task..."
            value={quickCaptureText}
            onChange={(e) => setQuickCaptureText(e.target.value)}
            className="w-[300px]"
            disabled={isCapturing}
          />
          <Button type="submit" size="icon" disabled={isCapturing || !quickCaptureText.trim()}>
            {isCapturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </form>
      }
    >
      <AppPageContent>
        <div className="flex flex-col gap-5">
          <Card className="grid grid-cols-2 divide-x divide-y divide-border lg:grid-cols-4 lg:divide-y-0">
            <OvertimeStatCard />
            <TasksCompletedCard />
            <ActiveFocusCountCard />
            <StreakCard />
          </Card>

          <ProductivityHeatmapCard />

          <div className="grid gap-5 lg:grid-cols-7">
            <div className="min-w-0 lg:col-span-4">
              <ActiveFocusCard />
            </div>
            <div className="min-w-0 space-y-5 lg:col-span-3">
              <ProjectsWatchlistCard />
              <RecentActivityCard />
              <PinnedNotesCard />
            </div>
          </div>
        </div>
      </AppPageContent>
    </AppPage>
  );
};
