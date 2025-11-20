import { RefreshCw, Plus, FolderSearch } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

interface ScriptsToolbarProps {
  onRefresh: () => void;
  onNewScript: () => void;
  onScanDirectory: () => void;
}

export const ScriptsToolbar = ({ onRefresh, onNewScript, onScanDirectory }: ScriptsToolbarProps) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleRefresh = () => {
    setIsAnimating(true);
    onRefresh();
    setTimeout(() => setIsAnimating(false), 600);
  };

  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-6 py-3.5 shadow-sm">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-foreground">Batch Scripts</h2>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isAnimating}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isAnimating ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={onScanDirectory}>
          <FolderSearch className="mr-2 h-4 w-4" />
          Scan Directory
        </Button>
        <Button variant="default" size="sm" onClick={onNewScript}>
          <Plus className="mr-2 h-4 w-4" />
          New Script
        </Button>
      </div>
    </div>
  );
};
