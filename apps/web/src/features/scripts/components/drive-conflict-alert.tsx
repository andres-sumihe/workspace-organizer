import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import type { DriveConflict } from '@workspace/shared';

import { Alert, AlertDescription } from '@/components/ui/alert';
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
    <Alert variant="warning" className="p-3">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-medium">
              {conflicts.length} Drive Conflict{conflicts.length > 1 ? 's' : ''}
            </span>
            <Badge variant="warning" className="shrink-0 text-xs">
              {driveLetters}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-7 text-xs hover:bg-warning-muted"
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
          <div className="mt-3 space-y-2 border-t border-warning/30 pt-3">
            {conflicts.map((conflict) => (
              <div key={conflict.driveLetter} className="rounded border border-warning/30 bg-card p-2">
                <p className="mb-1 font-mono text-xs font-semibold">
                  Drive {conflict.driveLetter}:
                </p>
                <ul className="space-y-0.5">
                  {conflict.scripts.map((script, idx) => (
                    <li key={idx} className="text-xs">
                      <span className="font-medium">{script.scriptName}</span>
                      <span className="ml-1 text-muted-foreground text-[11px]">→ {script.networkPath}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};
