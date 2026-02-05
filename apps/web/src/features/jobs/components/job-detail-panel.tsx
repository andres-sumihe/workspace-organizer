import { PlayCircle, PauseCircle, RefreshCw, Server, Calendar, FileCode, Hash, Link2, ExternalLink, Unlink, Loader2, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type { ControlMJobDetail } from '@workspace/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useLinkJobToScript, useUnlinkJobFromScript, useScriptSuggestions } from '@/hooks/use-jobs';
import { useScriptList } from '@/hooks/use-scripts';
import { formatTime } from '@/lib/utils'

interface JobDetailPanelProps {
  job: ControlMJobDetail | null;
  loading?: boolean;
  onEdit?: () => void;
}

export const JobDetailPanel = ({ job, loading, onEdit }: JobDetailPanelProps) => {
  const navigate = useNavigate();
  const [isLinkingMode, setIsLinkingMode] = useState(false);
  const [selectedScriptId, setSelectedScriptId] = useState<string>('');

  // Hooks for linking/unlinking
  const linkMutation = useLinkJobToScript();
  const unlinkMutation = useUnlinkJobFromScript();

  // Fetch script suggestions based on job's memName
  const { data: suggestionsData, isLoading: loadingSuggestions } = useScriptSuggestions(
    isLinkingMode && job?.memName ? job.id : null
  );

  // Fetch all scripts for manual selection (only when in linking mode)
  const { data: scriptsData, isLoading: loadingScripts } = useScriptList(
    isLinkingMode ? { pageSize: 100 } : { pageSize: 0 }
  );

  const suggestions = suggestionsData?.suggestions ?? [];
  const allScripts = scriptsData?.items ?? [];

  const handleLink = () => {
    if (!job || !selectedScriptId) return;
    linkMutation.mutate(
      { jobId: job.id, scriptId: selectedScriptId },
      {
        onSuccess: () => {
          setIsLinkingMode(false);
          setSelectedScriptId('');
        }
      }
    );
  };

  const handleUnlink = () => {
    if (!job) return;
    unlinkMutation.mutate(job.id);
  };

  const handleCancelLinking = () => {
    setIsLinkingMode(false);
    setSelectedScriptId('');
  };
  if (loading) {
    return (
      <div className="p-6 h-full">
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
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">{job.jobName}</h2>
            <p className="text-sm text-muted-foreground">ID: {job.jobId}</p>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <Button variant="ghost" size="icon" onClick={onEdit} title="Edit Job">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {job.isActive ? (
              <Badge variant="success">
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
                  <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-success-muted border border-success/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link2 className="h-4 w-4 text-success shrink-0" />
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-sm font-medium text-success hover:text-success/80 truncate"
                        onClick={() => navigate(`/scripts/${job.linkedScript!.id}`)}
                      >
                        {job.linkedScript.name}
                        <ExternalLink className="h-3 w-3 ml-1 shrink-0" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={handleUnlink}
                      disabled={unlinkMutation.isPending}
                    >
                      {unlinkMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Unlink className="h-3 w-3 mr-1" />
                          Unlink
                        </>
                      )}
                    </Button>
                  </div>
                ) : job.linkedScriptId ? (
                  <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-warning-muted border border-warning/30">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-warning" />
                      <span className="text-sm text-warning-foreground">
                        Script linked but not found
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={handleUnlink}
                      disabled={unlinkMutation.isPending}
                    >
                      {unlinkMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Unlink className="h-3 w-3 mr-1" />
                          Unlink
                        </>
                      )}
                    </Button>
                  </div>
                ) : isLinkingMode ? (
                  <div className="p-2 rounded-md bg-muted/50 border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Link to Script</span>
                    </div>
                    
                    {/* Script suggestions */}
                    {suggestions.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Suggestions based on "{job.memName}":</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {suggestions.slice(0, 5).map((s) => (
                            <Button
                              key={s.script.id}
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs"
                              onClick={() => setSelectedScriptId(s.script.id)}
                            >
                              {s.script.name}
                              {s.confidence >= 0.9 && (
                                <Badge variant="secondary" className="ml-1 h-4 text-[10px]">Best Match</Badge>
                              )}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Script dropdown selector */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        {suggestions.length > 0 ? 'Or select from all scripts:' : 'Select a script:'}
                      </label>
                      <Select 
                        value={selectedScriptId} 
                        onValueChange={setSelectedScriptId}
                        disabled={loadingScripts || loadingSuggestions}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={loadingScripts ? "Loading scripts..." : "Choose a script..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {allScripts.map((script) => (
                            <SelectItem key={script.id} value={script.id} className="text-xs">
                              {script.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={!selectedScriptId || linkMutation.isPending}
                        onClick={handleLink}
                      >
                        {linkMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Link2 className="h-3 w-3 mr-1" />
                        )}
                        Link Script
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={handleCancelLinking}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 border border-border">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Not linked to any script
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setIsLinkingMode(true)}
                    >
                      <Link2 className="h-3 w-3 mr-1" />
                      Link Script
                    </Button>
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
    </ScrollArea>
  );
};
