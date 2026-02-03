import { useQueryClient } from '@tanstack/react-query';
import { PanelRightClose, PanelRightOpen, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { JobDetailPanel } from './job-detail-panel';
import { JobImportDialog } from './job-import-dialog';
import { JobList } from './job-list';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useJobStats, useJobDetail, useClearAllJobs } from '@/hooks/use-jobs';
import { queryKeys } from '@/lib/query-client';


interface JobsTabProps {
  initialJobId?: string;
}

export const JobsTab = ({ initialJobId }: JobsTabProps) => {
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId ?? null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(true);

  // Use cached stats - reactive to data changes
  const { data: statsResponse } = useJobStats();
  const stats = statsResponse?.stats ?? null;

  // Use React Query for job detail - reactive caching
  const { data: detailResponse, isLoading: detailLoading } = useJobDetail(selectedJobId);
  const jobDetail = detailResponse?.job ?? null;

  // Use mutation hook for clearing all jobs
  const clearAllJobsMutation = useClearAllJobs();

  // Update selection when initialJobId changes (from URL navigation)
  useEffect(() => {
    if (initialJobId) {
      setSelectedJobId(initialJobId);
      setDetailPanelOpen(true);
    }
  }, [initialJobId]);

  const handleImportComplete = () => {
    // Invalidate all job-related queries
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
  };

  const handleClearAll = async () => {
    try {
      await clearAllJobsMutation.mutateAsync();
      setSelectedJobId(null);
    } catch (err) {
      console.error('Failed to clear jobs:', err);
    }
  };

  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId);
    setDetailPanelOpen(true); // Open panel when selecting a job
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header - Fixed at top */}
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex items-center gap-4">
          {/* Stats inline */}
          {stats && stats.totalJobs > 0 && (
            <div className="flex items-center gap-4 text-sm">
              <span><strong>{stats.totalJobs}</strong> jobs</span>
              <span className="text-success"><strong>{stats.activeJobs}</strong> active</span>
              <span className="text-pink-600"><strong>{stats.cyclicJobs}</strong> cyclic</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" title="Clear All Jobs">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear All Jobs?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all imported Control-M jobs and their dependencies.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground">
                  Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <JobImportDialog onImportComplete={handleImportComplete} />
        </div>
      </div>

      {/* Main Content - Grid layout with fixed detail panel width */}
      <div className="flex-1 min-h-0 overflow-hidden flex">
        {/* Job List - Takes remaining space, scrolls horizontally if needed */}
        <div className="flex-1 min-w-0 border-r border-border bg-card overflow-hidden flex flex-col">
          <JobList
            onJobSelect={handleJobSelect}
            selectedJobId={selectedJobId}
          />
        </div>

        {/* Detail Panel - Fixed width, collapsible */}
        <div 
          className={`shrink-0 bg-muted/20 overflow-hidden flex flex-col transition-all duration-200 ${
            detailPanelOpen ? 'w-96' : 'w-10'
          }`}
        >
          {detailPanelOpen ? (
            <>
              {/* Collapse button */}
              <div className="flex justify-end p-2 shrink-0 border-b">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setDetailPanelOpen(false)}
                  title="Collapse panel"
                >
                  <PanelRightClose className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <JobDetailPanel job={jobDetail} loading={detailLoading} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center pt-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setDetailPanelOpen(true)}
                title="Expand panel"
              >
                <PanelRightOpen className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
