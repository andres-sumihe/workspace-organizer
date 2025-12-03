import { FileCode, HardDrive, Plus, RefreshCw, FolderSearch } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { scanScripts } from '@/api/scripts';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ScriptsTab,
  DriveMappingsTab,
  ScriptDialog,
  ScanDirectoryDialog
} from '@/features/scripts';


export const ScriptsPage = () => {
  const [activeTab, setActiveTab] = useState('scripts');
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [canSelectFolder, setCanSelectFolder] = useState(false);
  
  // Key to force refresh of tabs
  const [refreshKey, setRefreshKey] = useState(0);

  // Check desktop capabilities
  useEffect(() => {
    setCanSelectFolder(typeof window !== 'undefined' && typeof window.api?.selectDirectory === 'function');
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleNewScript = () => {
    setDialogOpen(true);
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
    handleRefresh();
    return { count: result.count };
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Scripts</h1>
            <p className="text-sm text-muted-foreground">
              Manage batch scripts and network drive mappings
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleScanDirectory}>
              <FolderSearch className="mr-2 h-4 w-4" />
              Scan Directory
            </Button>
            <Button size="sm" onClick={handleNewScript}>
              <Plus className="mr-2 h-4 w-4" />
              New Script
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-border bg-muted px-6">
          <TabsList className="h-12 bg-transparent">
            <TabsTrigger value="scripts" className="gap-2">
              <FileCode className="h-4 w-4" />
              Scripts
            </TabsTrigger>
            <TabsTrigger value="drive-mappings" className="gap-2">
              <HardDrive className="h-4 w-4" />
              Drive Mappings
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="scripts" className="flex-1 m-0" key={`scripts-${refreshKey}`}>
          <div className="h-full flex flex-col">
            <ScriptsTab />
          </div>
        </TabsContent>

        <TabsContent value="drive-mappings" className="flex-1 m-0 overflow-auto" key={`mappings-${refreshKey}`}>
          <DriveMappingsTab />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ScriptDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mode="create"
        onSuccess={handleRefresh}
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

