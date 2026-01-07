import { useQueryClient } from '@tanstack/react-query';
import { PlayCircle, PauseCircle, RefreshCw, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import type { ControlMJob } from '@workspace/shared';

import { deleteJob } from '@/api/controlm-jobs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/ui/page-loader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { useJobList, useJobFilters } from '@/hooks/use-jobs';
import { queryKeys } from '@/lib/query-client';

interface JobListProps {
  onJobSelect?: (job: ControlMJob) => void;
  selectedJobId?: string | null;
  refreshKey?: number;
}

export const JobList = ({ onJobSelect, selectedJobId }: JobListProps) => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [application, setApplication] = useState<string>('');
  const [nodeId, setNodeId] = useState<string>('');
  const [taskType, setTaskType] = useState<string>('');
  const [isActive, setIsActive] = useState<string>('');

  const pageSize = 20;

  // Load available filters (cached)
  const { data: filters } = useJobFilters();

  // Load jobs with current filters (cached + invalidated on mutations)
  const { data: jobsResponse, isLoading } = useJobList({
    page,
    pageSize,
    searchQuery: search || undefined,
    application: application || undefined,
    nodeId: nodeId || undefined,
    taskType: taskType || undefined,
    isActive: isActive === '' ? undefined : isActive === 'true'
  });

  const jobs = jobsResponse?.items ?? [];
  const total = jobsResponse?.meta.total ?? 0;

  const handleDelete = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this job?')) return;
    try {
      await deleteJob(jobId);
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    } catch (err) {
      console.error('Failed to delete job:', err);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 border-b">
        <Input
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-48"
        />

        <Select value={application} onValueChange={(v) => { setApplication(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Application" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Applications</SelectItem>
            {filters?.applications.map(app => (
              <SelectItem key={app} value={app}>{app}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={nodeId} onValueChange={(v) => { setNodeId(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Node" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Nodes</SelectItem>
            {filters?.nodes.map(n => (
              <SelectItem key={n} value={n}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={taskType} onValueChange={(v) => { setTaskType(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Task Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Types</SelectItem>
            <SelectItem value="Job">Job</SelectItem>
            <SelectItem value="Dummy">Dummy</SelectItem>
            <SelectItem value="Command">Command</SelectItem>
            <SelectItem value="FileWatcher">FileWatcher</SelectItem>
          </SelectContent>
        </Select>

        <Select value={isActive} onValueChange={(v) => { setIsActive(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Status</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto relative">
        {isLoading ? (
          <PageLoader message="Loading jobs..." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Status</TableHead>
                <TableHead>Job Name</TableHead>
                <TableHead>Application</TableHead>
                <TableHead>Node</TableHead>
                <TableHead className="w-20">Type</TableHead>
                <TableHead className="w-20">Cyclic</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map(job => (
                <TableRow
                  key={job.id}
                  className={`cursor-pointer ${selectedJobId === job.id ? 'bg-muted' : ''}`}
                  onClick={() => onJobSelect?.(job)}
                >
                  <TableCell>
                    <div className="flex items-center justify-center">
                      {job.isActive ? (
                        <PlayCircle className="h-5 w-5 text-success" />
                      ) : (
                        <PauseCircle className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{job.jobName}</div>
                    {job.description && (
                      <div className="text-xs text-muted-foreground truncate max-w-xs">
                        {job.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{job.application}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{job.nodeId}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{job.taskType}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex pl-4">
                      {job.isCyclic && <RefreshCw className="h-4 w-4 text-pink-500" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={(e) => handleDelete(job.id, e)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No jobs found. Import Control-M jobs to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
