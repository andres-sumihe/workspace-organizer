import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { ScriptDetailPanel } from './script-detail-panel';
import { ScriptDialog } from './script-dialog';
import { ScriptsListPanel } from './scripts-list-panel';

import type { ScriptFilters } from '../types';

import { useScriptList, useScriptDetail, useDriveConflicts } from '@/hooks/use-scripts';
import { queryKeys } from '@/lib/query-client';

interface ScriptsTabProps {
  initialScriptId?: string;
}

export const ScriptsTab = ({ initialScriptId }: ScriptsTabProps) => {
  const queryClient = useQueryClient();
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(initialScriptId ?? null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [filters, setFilters] = useState<ScriptFilters>({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');

  // Fetch scripts list with caching
  const { data: scriptsResponse, isLoading: loading } = useScriptList({
    page,
    pageSize,
    type: filters.type,
    isActive: filters.isActive,
    driveLetter: filters.driveLetter,
    tagId: filters.tagId,
    searchQuery: filters.searchQuery
  });

  const scripts = scriptsResponse?.items ?? [];
  const total = scriptsResponse?.meta.total ?? null;

  // Fetch script detail with caching
  const { data: detailResponse, isLoading: detailLoading } = useScriptDetail(selectedScriptId);
  const selectedScript = detailResponse?.script ?? null;

  // Fetch conflicts with caching
  const { data: conflictsResponse } = useDriveConflicts();
  const conflicts = conflictsResponse?.conflicts ?? [];

  // Update selection when initialScriptId changes (from URL navigation)
  useEffect(() => {
    if (initialScriptId) {
      setSelectedScriptId(initialScriptId);
    }
  }, [initialScriptId]);

  const handleEditScript = () => {
    setDialogMode('edit');
    setDialogOpen(true);
  };

  const handleDeleteScript = () => {
    // Implement delete confirmation dialog
    console.log('Delete script:', selectedScriptId);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setSelectedScriptId(null);
  };

  const handleFilterChange = (newFilters: ScriptFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleDialogSuccess = () => {
    // Invalidate queries to refresh data
    queryClient.invalidateQueries({ queryKey: queryKeys.scripts.lists() });
    queryClient.invalidateQueries({ queryKey: queryKeys.scripts.stats() });
  };

  return (
    <>
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel - Scripts List */}
        <Panel defaultSize={35} minSize={20} maxSize={60}>
          <div className="h-full border-r border-border bg-card overflow-hidden flex flex-col p-4">
            <ScriptsListPanel
              items={scripts}
              loading={loading}
              selectedScriptId={selectedScriptId}
              onSelect={setSelectedScriptId}
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={handlePageChange}
              filters={filters}
              onFilterChange={handleFilterChange}
            />
          </div>
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />

        {/* Right Panel - Script Detail */}
        <Panel defaultSize={65} minSize={40}>
          <div className="h-full bg-muted/20">
            <ScriptDetailPanel
              script={selectedScript}
              loading={detailLoading}
              onEdit={handleEditScript}
              onDelete={handleDeleteScript}
              conflicts={conflicts}
            />
          </div>
        </Panel>
      </PanelGroup>

      {/* Edit Dialog */}
      <ScriptDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mode={dialogMode}
        scriptId={dialogMode === 'edit' ? selectedScriptId ?? undefined : undefined}
        onSuccess={handleDialogSuccess}
      />
    </>
  );
};
