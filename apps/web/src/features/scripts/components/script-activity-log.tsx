import { Loader2, History, User, Clock, FileEdit, FilePlus, Trash2, RefreshCcw, Link2 } from 'lucide-react';
import { useState } from 'react';

import type { AuditLogEntry, AuditAction } from '@workspace/shared';
import type React from 'react';


import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useScriptActivity } from '@/hooks/use-scripts';

interface ScriptActivityLogProps {
  scriptId: string;
}

const actionIcons: Partial<Record<AuditAction, React.ReactNode>> = {
  CREATE: <FilePlus className="h-4 w-4 text-green-500" />,
  UPDATE: <FileEdit className="h-4 w-4 text-blue-500" />,
  DELETE: <Trash2 className="h-4 w-4 text-red-500" />,
  READ: <History className="h-4 w-4 text-muted-foreground" />,
  LOGIN: <User className="h-4 w-4 text-muted-foreground" />,
  LOGOUT: <User className="h-4 w-4 text-muted-foreground" />,
  SCRIPT_CREATE: <FilePlus className="h-4 w-4 text-green-500" />,
  SCRIPT_UPDATE: <FileEdit className="h-4 w-4 text-blue-500" />,
  SCRIPT_DELETE: <Trash2 className="h-4 w-4 text-red-500" />,
  JOB_LINK: <Link2 className="h-4 w-4 text-blue-500" />,
  JOB_UNLINK: <Link2 className="h-4 w-4 text-orange-500" />,
  ROLE_CHANGE: <RefreshCcw className="h-4 w-4 text-orange-500" />,
};

const actionLabels: Partial<Record<AuditAction, string>> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  READ: 'Viewed',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  SCRIPT_CREATE: 'Script Created',
  SCRIPT_UPDATE: 'Script Updated',
  SCRIPT_DELETE: 'Script Deleted',
  JOB_LINK: 'Job Linked',
  JOB_UNLINK: 'Job Unlinked',
  JOB_DELETE: 'Job Deleted',
  JOB_IMPORT: 'Jobs Imported',
  ROLE_CHANGE: 'Role Changed',
  PASSWORD_CHANGED: 'Password Changed',
};

const actionColors: Partial<Record<AuditAction, string>> = {
  CREATE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  READ: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  LOGIN: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  LOGOUT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  SCRIPT_CREATE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  SCRIPT_UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  SCRIPT_DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  JOB_LINK: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  JOB_UNLINK: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  ROLE_CHANGE: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

const formatChanges = (entry: AuditLogEntry): string[] => {
  const changes: string[] = [];

  if (entry.newValue) {
    for (const [key, value] of Object.entries(entry.newValue)) {
      if (key === 'contentUpdated' && value === true) {
        changes.push('Script content was updated');
      } else if (key === 'tagsUpdated' && value === true) {
        changes.push('Tags were modified');
      } else if (entry.oldValue && key in entry.oldValue) {
        const oldVal = entry.oldValue[key];
        changes.push(`${key}: "${String(oldVal)}" → "${String(value)}"`);
      } else {
        changes.push(`${key}: ${String(value)}`);
      }
    }
  }

  return changes;
};

export const ScriptActivityLog = ({ scriptId }: ScriptActivityLogProps) => {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  
  const { data, isLoading, isError, error } = useScriptActivity(scriptId, page, pageSize);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-destructive">
          Failed to load activity log: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted/30 p-4 mb-4">
          <History className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium text-foreground mb-1">No Activity Yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Activity will appear here when changes are made to this script.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {data.items.map((entry) => (
          <div
            key={entry.id}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {actionIcons[entry.action] || <History className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={actionColors[entry.action] || ''} variant="secondary">
                    {actionLabels[entry.action] || entry.action}
                  </Badge>
                  <span className="text-sm text-muted-foreground">by</span>
                  <span className="text-sm font-medium text-foreground">
                    {entry.memberDisplayName || entry.memberEmail || 'System'}
                  </span>
                </div>
                
                {/* Changes */}
                {(entry.action === 'UPDATE' || entry.action === 'SCRIPT_UPDATE') && entry.newValue && (
                  <div className="mt-2 space-y-1">
                    {formatChanges(entry).map((change, idx) => (
                      <p key={idx} className="text-xs text-muted-foreground font-mono">
                        • {change}
                      </p>
                    ))}
                  </div>
                )}

                {/* Timestamp */}
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {data.meta && (data.meta.hasNextPage || data.meta.hasPreviousPage) && (
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Page {data.meta.page} of {Math.ceil(data.meta.total / data.meta.pageSize)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!data.meta.hasPreviousPage}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.meta.hasNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
