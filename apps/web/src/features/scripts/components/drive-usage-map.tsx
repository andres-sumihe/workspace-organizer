interface DriveUsageMapProps {
  usedDrives: string[];
  availableDrives: string[];
}

export const DriveUsageMap = ({ usedDrives, availableDrives }: DriveUsageMapProps) => {
  const allDrives = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div className="rounded border border-border p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Drive Letter Usage (A-Z)</h3>
      <div className="grid grid-cols-13 gap-1">
        {allDrives.map((drive) => {
          const isUsed = usedDrives.includes(drive);
          const isAvailable = availableDrives.includes(drive);
          return (
            <div
              key={drive}
              className={`flex h-8 w-8 items-center justify-center rounded border text-xs font-mono font-semibold ${
                isUsed
                  ? 'border-blue-600 bg-blue-100 text-blue-900'
                  : isAvailable
                    ? 'border-green-600 bg-green-100 text-green-900'
                    : 'border-gray-300 bg-gray-100 text-gray-500'
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
          <div className="h-3 w-3 rounded border border-blue-600 bg-blue-100" />
          <span className="text-muted-foreground">Used</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded border border-green-600 bg-green-100" />
          <span className="text-muted-foreground">Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded border border-gray-300 bg-gray-100" />
          <span className="text-muted-foreground">System</span>
        </div>
      </div>
    </div>
  );
};
