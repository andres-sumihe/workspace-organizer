import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, FileWarning } from 'lucide-react';
import { useState } from 'react';

import type { ISO20022ValidationResult } from '@/utils/iso20022-validator';
import type { SwiftMTValidationResult } from '@/utils/swift-mt-validator';

import { Button } from '@/components/ui/button';

/** Union type for validation results */
export type ValidationResultData = 
  | (ISO20022ValidationResult & { type: 'iso20022' })
  | (SwiftMTValidationResult & { type: 'swift-mt' });

interface ValidationResultProps {
  result: ValidationResultData;
}

export const ValidationResult = ({ result }: ValidationResultProps) => {
  const { isValid, errors, warnings } = result;
  const [expanded, setExpanded] = useState(false);
  const hasIssues = errors.length > 0 || warnings.length > 0;

  // Get message type and format based on result type
  const messageType = result.type === 'iso20022' 
    ? result.details.messageType 
    : result.messageType;
  
  const format = result.type === 'swift-mt' ? result.format : undefined;

  // Determine badge color based on type
  const typeBadgeClass = result.type === 'iso20022'
    ? 'bg-purple-100 text-purple-700 border border-purple-300'
    : 'bg-cyan-100 text-cyan-700 border border-cyan-300';
  
  const typeLabel = result.type === 'iso20022' ? 'MX' : 'MT';

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Type Badge */}
      <span className={`px-2 py-0.5 rounded-md font-medium ${typeBadgeClass}`}>
        {typeLabel}
      </span>

      {/* Status Badge */}
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
        isValid 
          ? 'bg-success-muted text-success border border-success/30' 
          : 'bg-destructive/10 text-destructive border border-destructive/30'
      }`}>
        {isValid ? (
          <CheckCircle2 className="size-3" />
        ) : (
          <AlertCircle className="size-3" />
        )}
        <span className="font-medium">{isValid ? 'Valid' : 'Invalid'}</span>
      </div>

      {/* Message Type */}
      {messageType && (
        <span className="px-2 py-0.5 rounded-md bg-info-muted text-foreground border border-info/30 font-mono">
          {messageType}
        </span>
      )}

      {/* Format (MT only) */}
      {format && format !== 'unknown' && (
        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-300 font-mono uppercase">
          {format === 'dos_pcc' ? 'DOS-PCC' : format === 'rje' ? 'RJE' : 'FIN'}
        </span>
      )}

      {/* Error Count */}
      {errors.length > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/30">
          <AlertCircle className="size-3" />
          {errors.length} {errors.length === 1 ? 'error' : 'errors'}
        </span>
      )}

      {/* Warning Count */}
      {warnings.length > 0 && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-warning-muted text-warning-foreground border border-warning/30">
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
              <div className="flex items-center gap-1 text-destructive font-medium">
                <AlertCircle className="size-3.5" />
                Errors
              </div>
              <ul className="space-y-0.5 ml-4 text-destructive">
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
              <div className="flex items-center gap-1 text-warning font-medium">
                <FileWarning className="size-3.5" />
                Warnings
              </div>
              <ul className="space-y-0.5 ml-4 text-warning-foreground">
                {warnings.map((warning, idx) => (
                  <li key={idx} className="text-xs list-disc">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Additional details for MT messages */}
          {result.type === 'swift-mt' && result.details && (
            <div className="space-y-1 mt-3 pt-3 border-t border-border">
              <div className="text-xs font-medium text-muted-foreground">Details</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {result.details.direction && (
                  <>
                    <span className="text-muted-foreground">Direction:</span>
                    <span className="font-mono capitalize">{result.details.direction}</span>
                  </>
                )}
                {result.details.senderBIC && (
                  <>
                    <span className="text-muted-foreground">Sender BIC:</span>
                    <span className="font-mono">{result.details.senderBIC}</span>
                  </>
                )}
                {result.details.receiverBIC && (
                  <>
                    <span className="text-muted-foreground">Receiver BIC:</span>
                    <span className="font-mono">{result.details.receiverBIC}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Additional details for ISO20022 messages */}
          {result.type === 'iso20022' && result.details && (
            <div className="space-y-1 mt-3 pt-3 border-t border-border">
              <div className="text-xs font-medium text-muted-foreground">Details</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {result.details.senderDN && (
                  <>
                    <span className="text-muted-foreground">Sender DN:</span>
                    <span className="font-mono truncate">{result.details.senderDN}</span>
                  </>
                )}
                {result.details.senderFullName && (
                  <>
                    <span className="text-muted-foreground">Sender Name:</span>
                    <span className="font-mono">{result.details.senderFullName}</span>
                  </>
                )}
                {result.details.receiverDN && (
                  <>
                    <span className="text-muted-foreground">Receiver DN:</span>
                    <span className="font-mono truncate">{result.details.receiverDN}</span>
                  </>
                )}
                {result.details.receiverFullName && (
                  <>
                    <span className="text-muted-foreground">Receiver Name:</span>
                    <span className="font-mono">{result.details.receiverFullName}</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};