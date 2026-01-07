import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { JobDetailPanel } from './job-detail-panel';
import { JobImportDialog } from './job-import-dialog';
import { JobList } from './job-list';

import type { ControlMJob, ControlMJobDetail } from '@workspace/shared';

import {
  fetchJobDetail,
  clearAllJobs
} from '@/api/controlm-jobs';
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
import { useJobStats } from '@/hooks/use-jobs';
import { queryKeys } from '@/lib/query-client';


interface JobsTabProps {
  initialJobId?: string;
}

export const JobsTab = ({ initialJobId }: JobsTabProps) => {
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<ControlMJob | null>(null);
  const [jobDetail, setJobDetail] = useState<ControlMJobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Use cached stats
  const { data: statsResponse } = useJobStats();
  const stats = statsResponse?.stats ?? null;

  // Load job detail when selected
  useEffect(() => {
    if (!selectedJob) {
      setJobDetail(null);
      return;
    }

    setDetailLoading(true);
    fetchJobDetail(selectedJob.id)
      .then((response) => setJobDetail(response.job))
      .catch(console.error)
      .finally(() => setDetailLoading(false));
  }, [selectedJob]);

  const handleImportComplete = () => {
    // Invalidate all job-related queries
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
  };

  const handleClearAll = async () => {
    try {
      await clearAllJobs();
      setSelectedJob(null);
      setJobDetail(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    } catch (err) {
      console.error('Failed to clear jobs:', err);
    }
  };

  // Load initial job if provided via props (from URL navigation)
  useEffect(() => {
    if (initialJobId && !selectedJob) {
      fetchJobDetail(initialJobId)
        .then((response) => {
          const job = response.job;
          setSelectedJob({
            id: job.id,
            jobId: job.jobId,
            jobName: job.jobName,
            application: job.application,
            groupName: job.groupName,
            memName: job.memName,
            description: job.description,
            nodeId: job.nodeId,
            owner: job.owner,
            taskType: job.taskType,
            isCyclic: job.isCyclic,
            priority: job.priority,
            isCritical: job.isCritical,
            isActive: job.isActive,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt
          });
          setJobDetail(job);
        })
        .catch(console.error);
    }
  }, [initialJobId, selectedJob]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
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

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Job List */}
        <div className="flex-1 border-r overflow-hidden">
          <JobList
            onJobSelect={setSelectedJob}
            selectedJobId={selectedJob?.id}
          />
        </div>
        {/* Detail Panel */}
        <div className="w-96 overflow-hidden">
          <JobDetailPanel job={jobDetail} loading={detailLoading} />
        </div>
      </div>
    </div>
  );
};
