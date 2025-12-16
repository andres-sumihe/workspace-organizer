interface DriveUsageMapProps {
  usedDrives: string[];
  availableDrives: string[];
  /** Map of drive letter to usage count (number of scripts using it) */
  usageCount?: Map<string, number>;
  /** Currently selected drive letters */
  selectedDrives?: Set<string>;
  /** Callback when drive selection changes */
  onSelectionChange?: (selected: Set<string>) => void;
}

/**
 * Get color classes based on usage count
 * Uses a heat map color scheme: neutral (0) → success (1) → warning gradient (2-3) → destructive (4+)
 */
const getUsageColorClasses = (count: number): string => {
  if (count === 0) {
    // Not used - neutral gray
    return 'border-slate-400 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  }
  if (count === 1) {
    // Low usage - success (green)
    return 'border-success bg-success-muted text-success dark:bg-success-muted';
  }
  if (count === 2) {
    // Medium-low - warning (yellow/amber)
    return 'border-warning bg-warning-muted text-warning-foreground dark:bg-warning-muted';
  }
  if (count === 3) {
    // Medium-high - orange (between warning and destructive)
    return 'border-orange-500 bg-orange-200 text-orange-900 dark:bg-orange-950 dark:text-orange-300';
  }
  // 4+ scripts - high usage - destructive (red)
  return 'border-destructive bg-destructive/20 text-destructive dark:bg-destructive/30';
};

export const DriveUsageMap = ({ 
  usedDrives, 
  availableDrives, 
  usageCount,
  selectedDrives,
  onSelectionChange 
}: DriveUsageMapProps) => {
  const allDrives = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  
  // System reserved drives (A-F typically)
  const systemDrives = new Set(
    allDrives.filter((d) => !usedDrives.includes(d) && !availableDrives.includes(d))
  );

  const handleDriveClick = (drive: string) => {
    if (!onSelectionChange) return;
    
    const isUsed = usedDrives.includes(drive);
    // Only allow selecting used drives
    if (!isUsed) return;
    
    const newSelection = new Set(selectedDrives);
    if (newSelection.has(drive)) {
      newSelection.delete(drive);
    } else {
      newSelection.add(drive);
    }
    onSelectionChange(newSelection);
  };

  const clearSelection = () => {
    onSelectionChange?.(new Set());
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Drive Letter Usage (A-Z)</h3>
        {selectedDrives && selectedDrives.size > 0 && (
          <button
            onClick={clearSelection}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear selection ({selectedDrives.size})
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {allDrives.map((drive) => {
          const isUsed = usedDrives.includes(drive);
          const isSystem = systemDrives.has(drive);
          const isSelected = selectedDrives?.has(drive) ?? false;
          const count = usageCount?.get(drive) ?? (isUsed ? 1 : 0);
          const isClickable = isUsed && onSelectionChange;
          
          // Determine styling based on usage
          let colorClasses: string;
          let title: string;
          
          if (isSystem) {
            // System reserved (not in usedDrives or availableDrives)
            colorClasses = 'border-border bg-muted text-muted-foreground';
            title = `${drive}: System reserved`;
          } else if (isUsed) {
            // Used by scripts - color intensity based on count
            colorClasses = getUsageColorClasses(count);
            title = `${drive}: Used by ${count} script${count > 1 ? 's' : ''} (click to ${isSelected ? 'deselect' : 'select'})`;
          } else {
            // Available (in network range but not used)
            colorClasses = getUsageColorClasses(0);
            title = `${drive}: Not used`;
          }

          // Add selection highlight - use outline instead of ring to avoid overlap
          const selectionClasses = isSelected 
            ? 'outline outline-[2px] outline-primary z-10' 
            : '';
          
          // Add cursor style for clickable drives
          const cursorClasses = isClickable ? 'cursor-pointer' : 'cursor-default';
          
          return (
            <div
              key={drive}
              onClick={() => handleDriveClick(drive)}
              className={`flex h-9 w-9 items-center justify-center rounded-md border text-xs font-mono font-semibold transition-colors shadow-sm ${colorClasses} ${selectionClasses} ${cursorClasses}`}
              title={title}
            >
              {drive}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded border border-slate-400 bg-slate-100 dark:bg-slate-800" />
          <span className="text-muted-foreground">Not Used</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded border border-success bg-success-muted" />
          <span className="text-muted-foreground">1 Script</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded border border-warning bg-warning-muted" />
          <span className="text-muted-foreground">2 Scripts</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded border border-orange-500 bg-orange-200 dark:bg-orange-950" />
          <span className="text-muted-foreground">3 Scripts</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded border border-destructive bg-destructive/20" />
          <span className="text-muted-foreground">4+ Scripts</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded border border-border bg-muted" />
          <span className="text-muted-foreground">System</span>
        </div>
      </div>
    </div>
  );
};
