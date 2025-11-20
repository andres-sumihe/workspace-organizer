import { useCallback, useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

import type { ScriptFilters } from '@/features/scripts/types';
import type { BatchScript, BatchScriptDetail, DriveConflict } from '@workspace/shared';

import { fetchScriptList, fetchScriptDetail, fetchConflicts, scanScripts } from '@/api/scripts';
import {
  ScriptsToolbar,
  ScriptsListPanel,
  ScriptDetailPanel,
  ScriptDialog,
  ScanDirectoryDialog
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
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [canSelectFolder, setCanSelectFolder] = useState(false);

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

  // Check desktop capabilities
  useEffect(() => {
    setCanSelectFolder(typeof window !== 'undefined' && typeof window.api?.selectDirectory === 'function');
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
    setScanDialogOpen(true);
  };

  const handleScan = async (values: { directoryPath: string; recursive: boolean; filePattern: string; replaceExisting: boolean }) => {
    const result = await scanScripts({
      directoryPath: values.directoryPath,
      recursive: values.recursive,
      filePattern: values.filePattern,
      replaceExisting: values.replaceExisting
    });
    await loadScripts();
    await loadConflicts();
    return { count: result.count };
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
    <div className="absolute inset-0 flex flex-col bg-background">
      <ScriptsToolbar
        onRefresh={handleRefresh}
        onNewScript={handleNewScript}
        onScanDirectory={handleScanDirectory}
      />

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

      {/* Dialogs */}
      <ScriptDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mode={dialogMode}
        scriptId={dialogMode === 'edit' ? selectedScriptId ?? undefined : undefined}
        onSuccess={() => void loadScripts()}
      />
      <ScanDirectoryDialog
        open={scanDialogOpen}
        onOpenChange={setScanDialogOpen}
        onScan={handleScan}
        canSelectFolder={canSelectFolder}
      />
    </div>
  );
};
