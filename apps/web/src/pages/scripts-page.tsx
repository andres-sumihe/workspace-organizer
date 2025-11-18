import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ScriptFilters } from '@/features/scripts/types';
import type { BatchScript, BatchScriptDetail, DriveConflict } from '@workspace/shared';

import { fetchScriptList, fetchScriptDetail, fetchConflicts } from '@/api/scripts';
import {
  ScriptsToolbar,
  ScriptsListPanel,
  ScriptDetailPanel,
  ScriptDialog,
  DriveConflictAlert
} from '@/features/scripts';


export const ScriptsPage = () => {
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
        tagId: filters.tagId
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

  // Filter scripts locally by search query
  const filteredScripts = useMemo(() => {
    if (!filters.searchQuery) return scripts;
    const query = filters.searchQuery.toLowerCase();
    return scripts.filter(
      (script) =>
        script.name.toLowerCase().includes(query) ||
        script.filePath.toLowerCase().includes(query) ||
        script.description?.toLowerCase().includes(query)
    );
  }, [scripts, filters.searchQuery]);

  const handleRefresh = () => {
    loadScripts();
    loadConflicts();
    if (selectedScriptId) {
      loadScriptDetail(selectedScriptId);
    }
  };

  const handleNewScript = () => {
    setDialogMode('create');
    setDialogOpen(true);
  };

  const handleEditScript = () => {
    setDialogMode('edit');
    setDialogOpen(true);
  };

  const handleDeleteScript = () => {
    // Implement delete confirmation dialog
    console.log('Delete script:', selectedScriptId);
  };

  const handleScanDirectory = () => {
    // Implement directory scan dialog
    console.log('Scan directory');
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
    <div className="flex h-full flex-col">
      <ScriptsToolbar
        onRefresh={handleRefresh}
        onNewScript={handleNewScript}
        onScanDirectory={handleScanDirectory}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Scripts List */}
        <div className="w-1/3 border-r bg-white p-4 overflow-y-auto">
          {conflicts.length > 0 && (
            <div className="mb-4">
              <DriveConflictAlert conflicts={conflicts} />
            </div>
          )}
          <ScriptsListPanel
            items={filteredScripts}
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

        {/* Right Panel - Script Detail */}
        <div className="flex-1 bg-gray-50">
          <ScriptDetailPanel
            script={selectedScript}
            loading={detailLoading}
            onEdit={handleEditScript}
            onDelete={handleDeleteScript}
          />
        </div>
      </div>

      {/* Dialog */}
      <ScriptDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mode={dialogMode}
        scriptId={dialogMode === 'edit' ? selectedScriptId ?? undefined : undefined}
      />
    </div>
  );
};
