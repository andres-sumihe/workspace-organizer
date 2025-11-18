import { Loader2, FileText, AlertCircle, CheckCircle } from 'lucide-react';

import type { ScriptFilters } from '../types';
import type { BatchScript } from '@workspace/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';


interface ScriptsListPanelProps {
  items: BatchScript[];
  loading: boolean;
  selectedScriptId: string | null;
  onSelect: (scriptId: string) => void;
  page: number;
  pageSize: number;
  total: number | null;
  onPageChange: (page: number) => void;
  filters: ScriptFilters;
  onFilterChange: (filters: ScriptFilters) => void;
}

export const ScriptsListPanel = ({
  items,
  loading,
  selectedScriptId,
  onSelect,
  page,
  pageSize,
  total,
  onPageChange,
  filters,
  onFilterChange
}: ScriptsListPanelProps) => {
  const handlePrev = () => {
    onPageChange(Math.max(1, page - 1));
  };

  const handleNext = () => {
    if (total !== null && page * pageSize >= total) return;
    onPageChange(page + 1);
  };

  const handleSearchChange = (e: { target: { value: string } }) => {
    onFilterChange({ ...filters, searchQuery: e.target.value });
  };

  const handleTypeChange = (value: string) => {
    onFilterChange({
      ...filters,
      type: value === 'all' ? undefined : (value as 'batch' | 'powershell' | 'shell' | 'other')
    });
  };

  const handleActiveChange = (value: string) => {
    onFilterChange({
      ...filters,
      isActive: value === 'all' ? undefined : value === 'active'
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Input
          placeholder="Search scripts..."
          value={filters.searchQuery || ''}
          onChange={handleSearchChange}
          className="col-span-1 sm:col-span-3"
        />
        <Select value={filters.type || 'all'} onValueChange={handleTypeChange}>
          <SelectTrigger>
            <SelectValue placeholder="Script Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="batch">Batch</SelectItem>
            <SelectItem value="powershell">PowerShell</SelectItem>
            <SelectItem value="shell">Shell</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.isActive === undefined ? 'all' : filters.isActive ? 'active' : 'inactive'}
          onValueChange={handleActiveChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Scripts</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="inactive">Inactive Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Script List */}
      {loading && items.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading scripts...
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No scripts found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((script) => {
            const isActive = selectedScriptId === script.id;
            return (
              <button
                key={script.id}
                type="button"
                onClick={() => onSelect(script.id)}
                className={`w-full rounded-md border p-3 text-left transition ${
                  isActive ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-muted-foreground'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{script.name}</p>
                      {script.isActive ? (
                        <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">{script.filePath}</p>
                  </div>
                  <div className="ml-2 flex flex-shrink-0 flex-col items-end gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {script.type}
                    </Badge>
                    {script.hasCredentials && (
                      <Badge variant="outline" className="text-xs text-orange-600">
                        Creds
                      </Badge>
                    )}
                  </div>
                </div>
                {script.description && (
                  <>
                    <Separator className="my-2" />
                    <p className="text-xs text-muted-foreground line-clamp-2">{script.description}</p>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total !== null ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div>
            {items.length} of {total} scripts
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handlePrev} disabled={page <= 1}>
              Prev
            </Button>
            <div className="text-xs">Page {page}</div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleNext}
              disabled={total !== null && page * pageSize >= total}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
