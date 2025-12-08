import { RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { JobDetailPanel } from './job-detail-panel';
import { JobImportDialog } from './job-import-dialog';
import { JobList } from './job-list';

import type { ControlMJob, ControlMJobDetail } from '@workspace/shared';

import {
  fetchJobDetail,
  fetchJobStats,
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


interface JobStats {
  totalJobs: number;
  activeJobs: number;
  cyclicJobs: number;
}

interface JobsTabProps {
  initialJobId?: string;
}

export const JobsTab = ({ initialJobId }: JobsTabProps) => {
  const [selectedJob, setSelectedJob] = useState<ControlMJob | null>(null);
  const [jobDetail, setJobDetail] = useState<ControlMJobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const response = await fetchJobStats();
      setStats(response.stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats, refreshKey]);

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
    setRefreshKey(k => k + 1);
  };

  const handleClearAll = async () => {
    try {
      await clearAllJobs();
      setSelectedJob(null);
      setJobDetail(null);
      setRefreshKey(k => k + 1);
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
              <span className="text-green-600"><strong>{stats.activeJobs}</strong> active</span>
              <span className="text-pink-600"><strong>{stats.cyclicJobs}</strong> cyclic</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey(k => k + 1)}
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
            refreshKey={refreshKey}
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
