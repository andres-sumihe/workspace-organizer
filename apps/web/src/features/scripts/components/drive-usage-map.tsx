import React from 'react';

import { useTheme } from '@/components/theme-provider';

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
 * Get inline styles based on usage count for reliable dark/light mode support
 * Using inline styles to avoid Tailwind purging issues with dynamic classes
 */
const getUsageStyles = (count: number, isDark: boolean): React.CSSProperties => {
  if (count === 0) {
    // Not used - neutral gray
    return {
      borderColor: isDark ? '#525252' : '#a3a3a3',
      backgroundColor: isDark ? '#262626' : '#f5f5f5',
      color: isDark ? '#a3a3a3' : '#525252',
    };
  }
  if (count === 1) {
    // Low usage - green
    return {
      borderColor: isDark ? '#22c55e' : '#16a34a',
      backgroundColor: isDark ? '#14532d' : '#dcfce7',
      color: isDark ? '#86efac' : '#166534',
    };
  }
  if (count === 2) {
    // Medium-low - yellow
    return {
      borderColor: isDark ? '#eab308' : '#ca8a04',
      backgroundColor: isDark ? '#422006' : '#fef9c3',
      color: isDark ? '#fde047' : '#854d0e',
    };
  }
  if (count === 3) {
    // Medium-high - orange
    return {
      borderColor: isDark ? '#f97316' : '#ea580c',
      backgroundColor: isDark ? '#431407' : '#ffedd5',
      color: isDark ? '#fdba74' : '#9a3412',
    };
  }
  // 4+ scripts - red
  return {
    borderColor: isDark ? '#ef4444' : '#dc2626',
    backgroundColor: isDark ? '#450a0a' : '#fee2e2',
    color: isDark ? '#fca5a5' : '#991b1b',
  };
};

/** Get system drive styles */
const getSystemStyles = (isDark: boolean): React.CSSProperties => ({
  borderColor: isDark ? '#404040' : '#d4d4d4',
  backgroundColor: isDark ? '#171717' : '#e5e5e5',
  color: isDark ? '#737373' : '#737373',
});

/** Get selected drive styles */
const getSelectedStyles = (): React.CSSProperties => ({
  outline: '1px solid #3b82f6',
  outlineOffset: '2px',
  zIndex: 10,
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
});

export const DriveUsageMap = ({ 
  usedDrives, 
  availableDrives, 
  usageCount,
  selectedDrives,
  onSelectionChange 
}: DriveUsageMapProps) => {
  const allDrives = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  
  // Use theme context for proper dark mode detection
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
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
            className="text-xs text-primary hover:text-primary/80 transition-colors font-medium"
          >
            Clear selection ({selectedDrives.size})
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {allDrives.map((drive) => {
          const isUsed = usedDrives.includes(drive);
          const isSystem = systemDrives.has(drive);
          const isSelected = selectedDrives?.has(drive) ?? false;
          const count = usageCount?.get(drive) ?? (isUsed ? 1 : 0);
          const isClickable = isUsed && onSelectionChange;
          
          // Determine styling based on usage
          let styles: React.CSSProperties;
          let title: string;
          
          if (isSystem) {
            styles = getSystemStyles(isDark);
            title = `${drive}: System reserved`;
          } else if (isUsed) {
            styles = getUsageStyles(count, isDark);
            title = `${drive}: Used by ${count} script${count > 1 ? 's' : ''} (click to ${isSelected ? 'deselect' : 'select'})`;
          } else {
            styles = getUsageStyles(0, isDark);
            title = `${drive}: Not used`;
          }

          // Add selection styles
          if (isSelected) {
            styles = { ...styles, ...getSelectedStyles() };
          }
          
          return (
            <div
              key={drive}
              onClick={() => handleDriveClick(drive)}
              style={{
                ...styles,
                borderWidth: '2px',
                borderStyle: 'solid',
                cursor: isClickable ? 'pointer' : 'default',
                transition: 'all 150ms ease',
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-md text-sm font-mono font-bold shadow-sm ${isClickable ? 'hover:shadow-md' : ''}`}
              title={title}
            >
              {drive}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div 
            className="h-3 w-3 rounded" 
            style={{ 
              ...getUsageStyles(0, isDark),
              borderWidth: '2px',
              borderStyle: 'solid',
            }} 
          />
          <span className="text-muted-foreground">Not Used</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div 
            className="h-3 w-3 rounded" 
            style={{ 
              ...getUsageStyles(1, isDark),
              borderWidth: '2px',
              borderStyle: 'solid',
            }} 
          />
          <span className="text-muted-foreground">1 Script</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div 
            className="h-3 w-3 rounded" 
            style={{ 
              ...getUsageStyles(2, isDark),
              borderWidth: '2px',
              borderStyle: 'solid',
            }} 
          />
          <span className="text-muted-foreground">2 Scripts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div 
            className="h-3 w-3 rounded" 
            style={{ 
              ...getUsageStyles(3, isDark),
              borderWidth: '2px',
              borderStyle: 'solid',
            }} 
          />
          <span className="text-muted-foreground">3 Scripts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div 
            className="h-3 w-3 rounded" 
            style={{ 
              ...getUsageStyles(4, isDark),
              borderWidth: '2px',
              borderStyle: 'solid',
            }} 
          />
          <span className="text-muted-foreground">4+ Scripts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div 
            className="h-3 w-3 rounded" 
            style={{ 
              ...getSystemStyles(isDark),
              borderWidth: '2px',
              borderStyle: 'solid',
            }} 
          />
          <span className="text-muted-foreground">System</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div 
            className="h-3 w-3 rounded" 
            style={{ 
              ...getUsageStyles(1, isDark),
              ...getSelectedStyles(),
              borderWidth: '2px',
              borderStyle: 'solid',
            }} 
          />
          <span className="text-muted-foreground">Selected</span>
        </div>
      </div>
    </div>
  );
};
