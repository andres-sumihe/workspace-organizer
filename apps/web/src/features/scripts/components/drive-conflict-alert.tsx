import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import type { DriveConflict } from '@workspace/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface DriveConflictAlertProps {
  conflicts: DriveConflict[];
}

export const DriveConflictAlert = ({ conflicts }: DriveConflictAlertProps) => {
  const [expanded, setExpanded] = useState(false);

  if (conflicts.length === 0) {
    return null;
  }

  // Get summary of conflicted drives
  const driveLetters = conflicts.map(c => c.driveLetter).join(', ');

  return (
    <div className="rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {conflicts.length} Drive Conflict{conflicts.length > 1 ? 's' : ''}
          </span>
          <Badge variant="outline" className="shrink-0 border-amber-600 text-amber-600 dark:border-amber-500 dark:text-amber-400 text-xs">
            {driveLetters}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-7 text-xs text-amber-800 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300 dark:hover:text-amber-200 dark:hover:bg-amber-900/30"
        >
          {expanded ? (
            <>
              <ChevronUp className="mr-1 h-3 w-3" />
              Hide
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-3 w-3" />
              Details
            </>
          )}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-amber-200 dark:border-amber-800 pt-3">
          {conflicts.map((conflict) => (
            <div key={conflict.driveLetter} className="rounded border border-amber-200 dark:border-amber-800 bg-card p-2">
              <p className="mb-1 font-mono text-xs font-semibold text-amber-900 dark:text-amber-200">
                Drive {conflict.driveLetter}:
              </p>
              <ul className="space-y-0.5">
                {conflict.scripts.map((script, idx) => (
                  <li key={idx} className="text-xs text-amber-800 dark:text-amber-300">
                    <span className="font-medium">{script.scriptName}</span>
                    <span className="ml-1 text-muted-foreground text-[11px]">→ {script.networkPath}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
