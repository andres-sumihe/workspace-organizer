import { Loader2, FileText, AlertCircle, CheckCircle, Search } from 'lucide-react';

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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filters - Fixed at top */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 mb-4 shrink-0">
        <div className="relative col-span-1 sm:col-span-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search scripts..."
            value={filters.searchQuery || ''}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>
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

      {/* Script List - Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && items.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading scripts...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted/30 p-6 mb-4">
              <FileText className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">No Scripts Found</h3>
            <p className="text-sm text-muted-foreground max-w-xs">Try adjusting your filters or add a new script to get started</p>
          </div>
        ) : (
          <div className="space-y-2 pr-2">
          {items.map((script) => {
            const isActive = selectedScriptId === script.id;
            return (
              <button
                key={script.id}
                type="button"
                onClick={() => onSelect(script.id)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  isActive 
                    ? 'border-primary bg-accent' 
                    : 'border-border hover:border-muted-foreground/25 hover:bg-accent/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{script.name}</p>
                      {script.isActive ? (
                        <CheckCircle className="h-3.5 w-3.5 shrink-0 text-success" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    {script.createdBy && (
                      <p className="mt-1 text-xs text-muted-foreground truncate">by {script.createdBy}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge variant="secondary" className="text-xs uppercase">
                      {script.type}
                    </Badge>
                    {script.hasCredentials && (
                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                        🔐 Creds
                      </Badge>
                    )}
                  </div>
                </div>
                {script.description && (
                  <>
                    <Separator className="my-2" />
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{script.description}</p>
                  </>
                )}
              </button>
            );
          })}
          </div>
        )}
      </div>

      {/* Pagination - Fixed at bottom */}
      {total !== null ? (
        <div className="flex items-center justify-between border-t border-border bg-card pt-3 text-sm text-muted-foreground shrink-0">
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
