import { useQueryClient } from '@tanstack/react-query';
import { PanelRightClose, PanelRightOpen, RefreshCw, Trash2, Link2, Plus, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { JobDetailPanel } from './job-detail-panel';
import { JobDialog } from './job-dialog';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useJobStats, useJobDetail, useClearAllJobs, useLinkingStatus, useAutoLinkJobs } from '@/hooks/use-jobs';
import { queryKeys } from '@/lib/query-client';


interface JobsTabProps {
  initialJobId?: string;
}

export const JobsTab = ({ initialJobId }: JobsTabProps) => {
  const queryClient = useQueryClient();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId ?? null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(true);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  // Use cached stats - reactive to data changes
  const { data: statsResponse } = useJobStats();
  const stats = statsResponse?.stats ?? null;

  // Use React Query for job detail - reactive caching
  const { data: detailResponse, isLoading: detailLoading } = useJobDetail(selectedJobId);
  const jobDetail = detailResponse?.job ?? null;

  // Use mutation hook for clearing all jobs
  const clearAllJobsMutation = useClearAllJobs();

  // Linking status and auto-link
  const { data: linkingStatus, refetch: refetchLinkingStatus } = useLinkingStatus();
  const autoLinkMutation = useAutoLinkJobs();

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

  const handleSyncScripts = async () => {
    try {
      await autoLinkMutation.mutateAsync();
      refetchLinkingStatus();
    } catch (err) {
      console.error('Failed to sync scripts:', err);
    }
  };

  const handleNewJob = () => {
    setEditingJobId(null);
    setJobDialogOpen(true);
  };

  const handleEditJob = () => {
    if (selectedJobId) {
      setEditingJobId(selectedJobId);
      setJobDialogOpen(true);
    }
  };

  const handleJobDialogClose = () => {
    setJobDialogOpen(false);
    setEditingJobId(null);
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSyncDialogOpen(true)}
            title="Sync Scripts"
          >
            <Link2 className="h-4 w-4 mr-1" />
            Sync Scripts
            {linkingStatus && linkingStatus.unlinkedJobs > 0 && (
              <Badge variant="secondary" className="ml-1 h-5">
                {linkingStatus.unlinkedJobs}
              </Badge>
            )}
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewJob}
            title="New Job"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Job
          </Button>
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
                <JobDetailPanel job={jobDetail} loading={detailLoading} onEdit={handleEditJob} />
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

      {/* Sync Scripts Dialog */}
      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Sync Scripts
            </DialogTitle>
            <DialogDescription>
              Automatically link Control-M jobs to scripts based on the script filename (memName).
            </DialogDescription>
          </DialogHeader>

          {linkingStatus && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{linkingStatus.totalJobs}</div>
                  <div className="text-muted-foreground">Total Jobs</div>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{linkingStatus.jobsWithMemName}</div>
                  <div className="text-muted-foreground">Jobs with Scripts</div>
                </div>
                <div className="p-3 bg-success-muted border border-success/30 rounded-lg">
                  <div className="text-2xl font-bold text-success">{linkingStatus.linkedJobs}</div>
                  <div className="text-muted-foreground">Linked</div>
                </div>
                <div className="p-3 bg-warning-muted border border-warning/30 rounded-lg">
                  <div className="text-2xl font-bold text-warning">{linkingStatus.unlinkedJobs}</div>
                  <div className="text-muted-foreground">Unlinked</div>
                </div>
              </div>

              {linkingStatus.jobsWithMemName > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success transition-all"
                      style={{ width: `${linkingStatus.linkingPercentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{linkingStatus.linkingPercentage}%</span>
                </div>
              )}

              {autoLinkMutation.data && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <div className="font-medium mb-1">Last sync result:</div>
                  <div className="text-muted-foreground">
                    {autoLinkMutation.data.newlyLinked} newly linked,{' '}
                    {autoLinkMutation.data.noMatchFound} no match found
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncDialogOpen(false)}>
              Close
            </Button>
            <Button
              onClick={handleSyncScripts}
              disabled={autoLinkMutation.isPending || (linkingStatus?.unlinkedJobs ?? 0) === 0}
            >
              {autoLinkMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Sync Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Create/Edit Dialog */}
      <JobDialog
        open={jobDialogOpen}
        onOpenChange={handleJobDialogClose}
        jobId={editingJobId}
        onSuccess={() => {
          handleJobDialogClose();
          queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
        }}
      />
    </div>
  );
};
