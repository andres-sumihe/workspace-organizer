import { useCallback, useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import { ScriptDetailPanel } from './script-detail-panel';
import { ScriptDialog } from './script-dialog';
import { ScriptsListPanel } from './scripts-list-panel';

import type { ScriptFilters } from '../types';
import type { BatchScript, BatchScriptDetail, DriveConflict } from '@workspace/shared';

import { fetchScriptList, fetchScriptDetail, fetchConflicts } from '@/api/scripts';

export const ScriptsTab = () => {
  const [scripts, setScripts] = useState<BatchScript[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<BatchScriptDetail | null>(null);
  const [conflicts, setConflicts] = useState<DriveConflict[]>([]);

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState<number | null>(null);

  const [filters, setFilters] = useState<ScriptFilters>({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');

  // Fetch scripts list
  const loadScripts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchScriptList(page, pageSize, {
        type: filters.type,
        isActive: filters.isActive,
        driveLetter: filters.driveLetter,
        tagId: filters.tagId,
        searchQuery: filters.searchQuery
      });
      setScripts(response.items);
      setTotal(response.meta.total);
    } catch (error) {
      console.error('Failed to load scripts:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  // Fetch script detail
  const loadScriptDetail = useCallback(async (scriptId: string) => {
    setDetailLoading(true);
    try {
      const response = await fetchScriptDetail(scriptId);
      setSelectedScript(response.script);
    } catch (error) {
      console.error('Failed to load script detail:', error);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Fetch conflicts
  const loadConflicts = useCallback(async () => {
    try {
      const response = await fetchConflicts();
      setConflicts(response.conflicts);
    } catch (error) {
      console.error('Failed to load conflicts:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadScripts();
    loadConflicts();
  }, [loadScripts, loadConflicts]);

  // Load detail when selection changes
  useEffect(() => {
    if (selectedScriptId) {
      loadScriptDetail(selectedScriptId);
    } else {
      setSelectedScript(null);
    }
  }, [selectedScriptId, loadScriptDetail]);

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
        onSuccess={() => void loadScripts()}
      />
    </>
  );
};
