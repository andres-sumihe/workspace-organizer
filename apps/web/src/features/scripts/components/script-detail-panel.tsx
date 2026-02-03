import { Loader2, FileCode, MapPin, Tag, Link2, AlertTriangle, Trash2, Edit, Server, ExternalLink, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { DriveConflictAlert } from './drive-conflict-alert';
import { ScriptActivityLog } from './script-activity-log';

import type { BatchScriptDetail, DriveConflict } from '@workspace/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ScriptDetailPanelProps {
  script: BatchScriptDetail | null;
  loading: boolean;
  onEdit: () => void;
  onDelete: () => void;
  conflicts: DriveConflict[];
}

export const ScriptDetailPanel = ({ script, loading, onEdit, onDelete, conflicts }: ScriptDetailPanelProps) => {
  const navigate = useNavigate();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!script) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center px-4">
        <div className="rounded-full bg-muted/30 p-6 mb-4">
          <FileCode className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No Script Selected</h3>
        <p className="text-sm text-muted-foreground max-w-sm">Select a script from the list to view its details, drive mappings, and dependencies</p>
      </div>
    );
  }

  // Find conflicts related to this script
  const scriptConflicts = conflicts.filter(conflict =>
    conflict.scripts.some(s => s.scriptName === script.name)
  );

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-foreground">{script.name}</h2>
          {script.createdBy && (
            <p className="mt-1 text-sm text-muted-foreground">Created by {script.createdBy}</p>
          )}
        </div>
        <div className="ml-4 flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Badges */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Badge variant="secondary">{script.type}</Badge>
        {script.isActive ? (
          <Badge variant="default">Active</Badge>
        ) : (
          <Badge variant="outline">Inactive</Badge>
        )}
        {script.hasCredentials && (
          <Badge variant="outline" className="border-orange-600 text-orange-600">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Has Credentials
          </Badge>
        )}
      </div>

      {/* Drive Conflicts for this script */}
      {scriptConflicts.length > 0 && (
        <div className="mb-6">
          <DriveConflictAlert conflicts={scriptConflicts} />
        </div>
      )}

      {/* Description */}
      {script.description && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-foreground">Description</h3>
          <p className="text-sm text-muted-foreground">{script.description}</p>
        </div>
      )}

      <Separator className="my-6" />

      {/* Tabs for Details and Activity */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">
            <FileCode className="mr-2 h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="activity">
            <History className="mr-2 h-4 w-4" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          {/* Drive Mappings */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Drive Mappings</h3>
              <Badge variant="secondary">{script.driveMappings.length}</Badge>
            </div>
            {script.driveMappings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No drive mappings found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drive</TableHead>
                    <TableHead>Network Path</TableHead>
                    <TableHead>Server</TableHead>
                    <TableHead>Credentials</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {script.driveMappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-mono font-semibold">{mapping.driveLetter}</TableCell>
                      <TableCell className="font-mono text-xs">{mapping.networkPath}</TableCell>
                      <TableCell>{mapping.serverName || '—'}</TableCell>
                      <TableCell>
                        {mapping.hasCredentials ? (
                          <Badge variant="outline" className="text-orange-600">
                            {mapping.username || 'Yes'}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <Separator className="my-6" />

          {/* Tags */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Tags</h3>
            </div>
            {script.tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {script.tags.map((tag) => (
                  <Badge key={tag.id} variant="outline" style={{ backgroundColor: tag.color }}>
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <Separator className="my-6" />

          {/* Dependencies */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Dependencies</h3>
            </div>
            {script.dependencies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dependencies</p>
            ) : (
              <div className="space-y-2">
                {script.dependencies.map((dep) => (
                  <div key={dep.id} className="rounded border border-border p-2">
                    <p className="text-sm font-medium text-foreground">{dep.name}</p>
                    <p className="text-xs text-muted-foreground">{dep.type}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dependents */}
          {script.dependents.length > 0 && (
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2">
                <Link2 className="h-4 w-4 rotate-180 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Used By Scripts</h3>
              </div>
              <div className="space-y-2">
                {script.dependents.map((dep) => (
                  <div key={dep.id} className="rounded border border-border p-2">
                    <p className="text-sm font-medium text-foreground">{dep.name}</p>
                    <p className="text-xs text-muted-foreground">{dep.type}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator className="my-6" />

          {/* Used by Control-M Jobs */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Used by Control-M Jobs</h3>
              {script.linkedJobs && script.linkedJobs.length > 0 && (
                <Badge variant="secondary">{script.linkedJobs.length}</Badge>
              )}
            </div>
            {!script.linkedJobs || script.linkedJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Control-M jobs are linked to this script</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Job Name</TableHead>
                    <TableHead>Application</TableHead>
                    <TableHead>Node</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {script.linkedJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-xs">{job.jobId}</TableCell>
                      <TableCell className="font-medium">{job.jobName}</TableCell>
                      <TableCell className="text-muted-foreground">{job.application}</TableCell>
                      <TableCell className="text-muted-foreground">{job.nodeId}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => navigate(`/scripts?tab=jobs&jobId=${job.id}`)}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <Separator className="my-6" />

          {/* Script Content */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <FileCode className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Script Content</h3>
            </div>
            <div className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/30 p-4 shadow-sm">
              <pre className="text-xs font-mono text-foreground whitespace-pre-wrap wrap-break-word leading-relaxed">{script.content}</pre>
            </div>
          </div>

          {/* Metadata */}
          <div className="text-xs text-muted-foreground">
            <p>Created: {new Date(script.createdAt).toLocaleString()}</p>
            <p>Updated: {new Date(script.updatedAt).toLocaleString()}</p>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <ScriptActivityLog scriptId={script.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
