import { AlertTriangle } from 'lucide-react';

import type { DriveConflict } from '@workspace/shared';

import { Badge } from '@/components/ui/badge';

interface DriveConflictAlertProps {
  conflicts: DriveConflict[];
}

export const DriveConflictAlert = ({ conflicts }: DriveConflictAlertProps) => {
  if (conflicts.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-orange-300 bg-orange-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-orange-600" />
        <h3 className="font-semibold text-orange-900">Drive Letter Conflicts Detected</h3>
        <Badge variant="outline" className="border-orange-600 text-orange-600">
          {conflicts.length}
        </Badge>
      </div>
      <p className="mb-3 text-sm text-orange-800">
        Multiple scripts are attempting to map the same drive letters. This may cause issues during execution.
      </p>
      <div className="space-y-3">
        {conflicts.map((conflict) => (
          <div key={conflict.driveLetter} className="rounded border border-orange-200 bg-white p-3">
            <p className="mb-2 font-mono text-sm font-semibold text-orange-900">
              Drive {conflict.driveLetter}
            </p>
            <ul className="space-y-1">
              {conflict.scripts.map((script, idx) => (
                <li key={idx} className="text-xs text-orange-800">
                  <span className="font-medium">{script.scriptName}</span>
                  <span className="ml-2 text-muted-foreground">→ {script.networkPath}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
