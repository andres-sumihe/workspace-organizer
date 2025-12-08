import { PlayCircle, PauseCircle, RefreshCw, Server, Calendar, FileCode, Hash, Link2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import type { ControlMJobDetail } from '@workspace/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatTime } from '@/lib/utils'

interface JobDetailPanelProps {
  job: ControlMJobDetail | null;
  loading?: boolean;
}

export const JobDetailPanel = ({ job, loading }: JobDetailPanelProps) => {
  const navigate = useNavigate();
  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a job to view details
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">{job.jobName}</h2>
          <p className="text-sm text-muted-foreground">ID: {job.jobId}</p>
        </div>
        <div className="flex items-center gap-2">
          {job.isActive ? (
            <Badge variant="default" className="bg-green-500">
              <PlayCircle className="h-3 w-3 mr-1" />
              Active
            </Badge>
          ) : (
            <Badge variant="destructive">
              <PauseCircle className="h-3 w-3 mr-1" />
              Inactive
            </Badge>
          )}
          {job.isCyclic && (
            <Badge variant="secondary">
              <RefreshCw className="h-3 w-3 mr-1" />
              Cyclic
            </Badge>
          )}
        </div>
      </div>

      {/* Description */}
      {job.description && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <p className="text-sm whitespace-pre-wrap">{job.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="py-2 space-y-3">
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Node:</span>
              <span className="font-medium">{job.nodeId}</span>
              <Badge variant="outline">{job.taskType}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Application:</span>
              <span className="font-medium">{job.application}</span>
            </div>
            {job.groupName && (
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Group:</span>
                <span className="font-medium">{job.groupName}</span>
              </div>
            )}
          </div>

          {job.memName && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Script:</span>
                  <code className="ml-2 px-2 py-1 bg-muted rounded text-xs">{job.memName}</code>
                </div>
                
                {/* Linked Script - Show if linked */}
                {job.linkedScript ? (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 border border-green-500/20">
                    <Link2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600 dark:text-green-400">Linked to:</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-700"
                      onClick={() => navigate(`/scripts/${job.linkedScript!.id}`)}
                    >
                      {job.linkedScript.name}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                ) : job.linkedScriptId ? (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                    <Link2 className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-yellow-600 dark:text-yellow-400">
                      Script linked but not found
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Not linked to any script
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {job.memLib && (
            <div className="text-sm">
              <span className="text-muted-foreground">Directory:</span>
              <code className="ml-2 px-2 py-1 bg-muted rounded text-xs">{job.memLib}</code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduling */}
      {(job.fromTime || job.toTime || job.daysCalendar || job.weeksCalendar) && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Scheduling
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-2 text-sm">
            {(job.fromTime || job.toTime) && (
              <div className="flex items-center gap-4">
                {job.fromTime && (
                  <div>
                    <span className="text-muted-foreground">From:</span>
                    <span className="ml-2 font-mono">{formatTime(job.fromTime)}</span>
                  </div>
                )}
                {job.toTime && (
                  <div>
                    <span className="text-muted-foreground">Until:</span>
                    <span className="ml-2 font-mono">{formatTime(job.toTime)}</span>
                  </div>
                )}
              </div>
            )}
            {job.daysCalendar && (
              <div>
                <span className="text-muted-foreground">Days Calendar:</span>
                <span className="ml-2">{job.daysCalendar}</span>
              </div>
            )}
            {job.weeksCalendar && (
              <div>
                <span className="text-muted-foreground">Weeks Calendar:</span>
                <span className="ml-2">{job.weeksCalendar}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dependencies */}
      {(job.predecessors.length > 0 || job.successors.length > 0) && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Dependencies</CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-4">
            {job.predecessors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Predecessors ({job.predecessors.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {job.predecessors.map((pred) => (
                    <Badge key={pred.id} variant="outline" className="text-xs">
                      {pred.jobName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {job.successors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Successors ({job.successors.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {job.successors.map((succ) => (
                    <Badge key={succ.id} variant="secondary" className="text-xs">
                      {succ.jobName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Conditions */}
      {job.conditions.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Conditions ({job.conditions.length})</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="space-y-2">
              {job.conditions.map((cond) => (
                <div key={cond.id} className="flex items-center gap-2 text-sm">
                  <Badge variant={cond.conditionType === 'IN' ? 'default' : 'secondary'}>
                    {cond.conditionType}
                  </Badge>
                  <code className="px-2 py-1 bg-muted rounded text-xs">{cond.conditionName}</code>
                  {cond.odate && (
                    <span className="text-muted-foreground text-xs">({cond.odate})</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
