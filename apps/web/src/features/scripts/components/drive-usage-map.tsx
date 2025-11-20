interface DriveUsageMapProps {
  usedDrives: string[];
  availableDrives: string[];
}

export const DriveUsageMap = ({ usedDrives, availableDrives }: DriveUsageMapProps) => {
  const allDrives = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Drive Letter Usage (A-Z)</h3>
      <div className="flex flex-wrap gap-1.5">
        {allDrives.map((drive) => {
          const isUsed = usedDrives.includes(drive);
          const isAvailable = availableDrives.includes(drive);
          return (
            <div
              key={drive}
              className={`flex h-9 w-9 items-center justify-center rounded-md border text-xs font-mono font-semibold transition-all hover:scale-105 ${
                isUsed
                  ? 'border-blue-600 bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300 shadow-sm'
                  : isAvailable
                    ? 'border-green-600 bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-300'
                    : 'border-border bg-muted text-muted-foreground'
              }`}
              title={isUsed ? `${drive}: In use` : isAvailable ? `${drive}: Available` : `${drive}: System`}
            >
              {drive}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded border border-blue-600 bg-blue-100 dark:bg-blue-950" />
          <span className="text-muted-foreground">Used</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded border border-green-600 bg-green-100 dark:bg-green-950" />
          <span className="text-muted-foreground">Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded border border-border bg-muted" />
          <span className="text-muted-foreground">System</span>
        </div>
      </div>
    </div>
  );
};
