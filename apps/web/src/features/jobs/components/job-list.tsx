import { PlayCircle, PauseCircle, RefreshCw, Trash2, Search } from 'lucide-react';
import React, { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/ui/page-loader';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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
import { useJobList, useJobFilters, useDeleteJob } from '@/hooks/use-jobs';

interface JobListProps {
  onJobSelect?: (jobId: string) => void;
  selectedJobId?: string | null;
}

export const JobList = ({ onJobSelect, selectedJobId }: JobListProps) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [application, setApplication] = useState<string>('');
  const [nodeId, setNodeId] = useState<string>('');
  const [taskType, setTaskType] = useState<string>('');
  const [isActive, setIsActive] = useState<string>('');

  const pageSize = 20;

  // Load available filters (cached) - reactive to data changes
  const { data: filters } = useJobFilters();

  // Load jobs with current filters (cached + invalidated on mutations) - reactive
  const { data: jobsResponse, isLoading } = useJobList({
    page,
    pageSize,
    searchQuery: search || undefined,
    application: application || undefined,
    nodeId: nodeId || undefined,
    taskType: taskType || undefined,
    isActive: isActive === '' ? undefined : isActive === 'true'
  });

  // Use mutation hook for deleting jobs - reactive
  const deleteJobMutation = useDeleteJob();

  const jobs = jobsResponse?.items ?? [];
  const total = jobsResponse?.meta.total ?? 0;

  const handleDelete = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this job?')) return;
    try {
      await deleteJobMutation.mutateAsync(jobId);
    } catch (err) {
      console.error('Failed to delete job:', err);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col h-full">
      {/* Filters - Fixed at top */}
      <div className="flex flex-wrap gap-3 p-4 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 w-48"
          />
        </div>

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

      {/* Table - Scrollable content with horizontal scroll */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <PageLoader message="Loading jobs..." />
        ) : (
          <Table className="w-full">
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-16 whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap">Job Name</TableHead>
                <TableHead className="whitespace-nowrap">Application</TableHead>
                <TableHead className="whitespace-nowrap">Node</TableHead>
                <TableHead className="whitespace-nowrap">Type</TableHead>
                <TableHead className="whitespace-nowrap">Cyclic</TableHead>
                <TableHead className="w-16 whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map(job => (
                <TableRow
                  key={job.id}
                  className={`cursor-pointer ${selectedJobId === job.id ? 'bg-muted' : ''}`}
                  onClick={() => onJobSelect?.(job.id)}
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
                    <div className="font-medium whitespace-nowrap">{job.jobName}</div>
                    {job.description && (
                      <div className="text-xs text-muted-foreground truncate max-w-80">
                        {job.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="whitespace-nowrap">{job.application}</Badge>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{job.nodeId}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="whitespace-nowrap">{job.taskType}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      {job.isCyclic && <RefreshCw className="h-4 w-4 text-pink-500" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      onClick={(e) => handleDelete(job.id, e)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Pagination - Sticky at bottom */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t shrink-0">
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
