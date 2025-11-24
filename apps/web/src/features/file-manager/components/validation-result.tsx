import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, FileWarning } from 'lucide-react';
import { useState } from 'react';

import type { ISO20022ValidationResult } from '@/utils/iso20022-validator';

import { Button } from '@/components/ui/button';

interface ValidationResultProps {
  result: ISO20022ValidationResult;
}

export const ValidationResult = ({ result }: ValidationResultProps) => {
  const { isValid, errors, warnings, details } = result;
  const [expanded, setExpanded] = useState(false);
  const hasIssues = errors.length > 0 || warnings.length > 0;

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Status Badge */}
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
        isValid 
          ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
          : 'bg-red-100 text-red-700 border border-red-300'
      }`}>
        {isValid ? (
          <CheckCircle2 className="size-3" />
        ) : (
          <AlertCircle className="size-3" />
        )}
        <span className="font-medium">{isValid ? 'Valid' : 'Invalid'}</span>
      </div>

      {/* Message Type */}
      {details.messageType && (
        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 border border-blue-300 font-mono">
          {details.messageType}
        </span>
      )}

      {/* Error Count */}
      {errors.length > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-200">
          <AlertCircle className="size-3" />
          {errors.length} {errors.length === 1 ? 'error' : 'errors'}
        </span>
      )}

      {/* Warning Count */}
      {warnings.length > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-200">
          <FileWarning className="size-3" />
          {warnings.length} {warnings.length === 1 ? 'warning' : 'warnings'}
        </span>
      )}

      {/* Expand/Collapse Button */}
      {hasIssues && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1 text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          {expanded ? 'Hide' : 'Show'} details
        </Button>
      )}

      {/* Expandable Details */}
      {expanded && hasIssues && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-background border border-border rounded-md shadow-lg p-3 z-10 max-h-64 overflow-y-auto">
          {errors.length > 0 && (
            <div className="space-y-1 mb-3">
              <div className="flex items-center gap-1 text-red-700 font-medium">
                <AlertCircle className="size-3.5" />
                Errors
              </div>
              <ul className="space-y-0.5 ml-4 text-red-600">
                {errors.map((error, idx) => (
                  <li key={idx} className="text-xs list-disc">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-amber-700 font-medium">
                <FileWarning className="size-3.5" />
                Warnings
              </div>
              <ul className="space-y-0.5 ml-4 text-amber-600">
                {warnings.map((warning, idx) => (
                  <li key={idx} className="text-xs list-disc">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
