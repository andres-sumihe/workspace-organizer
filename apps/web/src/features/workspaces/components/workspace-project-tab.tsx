import { AlertCircle, FolderOpen, Trash } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { DeleteConfirmDialog } from './delete-confirm-dialog';
import { DirectoryBrowser, type DirectoryBrowserHandle } from './directory-browser';
import { FileOperationsToolbar } from './file-operations-toolbar';
import { PayloadDialog } from './payload-dialog';
import { PreviewPanel } from './preview-panel';
import { ProjectSelector } from './project-selector';
import { SplitDialog } from './split-dialog';
import { useDirectoryNavigation } from '../hooks/use-directory-navigation';
import { useFileOperations } from '../hooks/use-file-operations';
import { useFilePreview } from '../hooks/use-file-preview';
import { useProjectManagement, type Project } from '../hooks/use-project-management';

import type { SplitFormValues } from '../types';
import type { CheckedState } from '@radix-ui/react-checkbox';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFileManagerState } from '@/contexts/file-manager-context';
import { useWorkspaceContext } from '@/contexts/workspace-context';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const DesktopOnlyBanner = () => (
  <div className="flex items-start gap-2 rounded-md border border-dashed border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-400">
    <AlertCircle className="mt-0.5 size-4 shrink-0" />
    <p>
      File management actions require the desktop shell. Launch via <code>npm run dev:desktop</code> to enable browsing,
      merge, and split tools.
    </p>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WorkspaceFilesTabProps {
  workspaceId: string;
}

interface ProjectFormData {
  name: string;
  relativePath: string;
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const WorkspaceFilesTab = ({ workspaceId }: WorkspaceFilesTabProps) => {
  const { workspaces } = useWorkspaceContext();
  const { getState, updateState } = useFileManagerState();
  
  const activeWorkspace = useMemo(
    () => workspaces.find((ws) => ws.id === workspaceId),
    [workspaceId, workspaces]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Desktop availability
  // ─────────────────────────────────────────────────────────────────────────
  
  const [desktopAvailable, setDesktopAvailable] = useState(false);
  
  useEffect(() => {
    setDesktopAvailable(typeof window !== 'undefined' && typeof window.api?.listDirectory === 'function');
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Persisted state restoration
  // ─────────────────────────────────────────────────────────────────────────
  
  const initialPersistedState = useRef<ReturnType<typeof getState> | null>(null);
  if (initialPersistedState.current === null && workspaceId) {
    initialPersistedState.current = getState(workspaceId);
  }
  
  const isInitialMount = useRef(true);
  const hasInitialized = useRef(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Project Management
  // ─────────────────────────────────────────────────────────────────────────
  
  const {
    projects,
    projectsRef,
    selectedProjectId,
    setSelectedProjectId,
    loading: projectsLoading,
    isLoaded: projectsLoaded,
    loadProjects
  } = useProjectManagement(workspaceId, {
    initialSelectedProjectId: initialPersistedState.current?.selectedProjectId,
    onError: (msg) => setOperationError(msg)
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Path helpers
  // ─────────────────────────────────────────────────────────────────────────
  
  const getEffectiveRootPath = useCallback(() => {
    const project = projectsRef.current.find(p => p.id === selectedProjectId);
    if (!project) return activeWorkspace?.rootPath || '';
    
    const projectBasePath = project.relativePath;
    const isAbsolutePath = /^[a-zA-Z]:[\\/]/.test(projectBasePath) || projectBasePath.startsWith('/');
    
    return isAbsolutePath ? projectBasePath : activeWorkspace?.rootPath || '';
  }, [selectedProjectId, activeWorkspace?.rootPath, projectsRef]);

  const getRelativePath = useCallback((targetPath: string) => {
    const project = projectsRef.current.find(p => p.id === selectedProjectId);
    if (!project) return { rootPath: '', relativePath: targetPath };
    
    const projectBasePath = project.relativePath;
    const isAbsolutePath = /^[a-zA-Z]:[\\/]/.test(projectBasePath) || projectBasePath.startsWith('/');
    
    if (isAbsolutePath) {
      return { rootPath: projectBasePath, relativePath: targetPath || '.' };
    }
    return {
      rootPath: activeWorkspace?.rootPath || '',
      relativePath: targetPath ? `${projectBasePath}/${targetPath}` : projectBasePath
    };
  }, [selectedProjectId, activeWorkspace?.rootPath, projectsRef]);

  // ─────────────────────────────────────────────────────────────────────────
  // Directory Navigation
  // ─────────────────────────────────────────────────────────────────────────
  
  const {
    entries,
    setEntries,
    breadcrumbs,
    setBreadcrumbs,
    currentPath,
    setCurrentPath,
    loading: directoryLoading,
    error: directoryError,
    loadDirectory
  } = useDirectoryNavigation({
    getEffectiveRootPath,
    getRelativePath,
    desktopAvailable
  });

  // ─────────────────────────────────────────────────────────────────────────
  // File Preview
  // ─────────────────────────────────────────────────────────────────────────
  
  const {
    preview,
    setPreview,
    mediaPreview,
    mediaType,
    previewMode,
    setPreviewMode,
    previewError,
    binaryPreview,
    editMode,
    editBuffer,
    setEditBuffer,
    saving,
    loadPreview,
    clearPreview,
    handleToggleEditMode,
    saveEdit
  } = useFilePreview({ getEffectiveRootPath });

  // Ref for DirectoryBrowser to update highlight imperatively
  const directoryBrowserRef = useRef<DirectoryBrowserHandle>(null);

  // Update highlight when preview changes (imperatively, no re-render)
  useEffect(() => {
    const activePath = preview?.path || mediaPreview?.path || null;
    directoryBrowserRef.current?.setActiveHighlight(activePath);
  }, [preview?.path, mediaPreview?.path]);

  // ─────────────────────────────────────────────────────────────────────────
  // File Operations
  // ─────────────────────────────────────────────────────────────────────────
  
  const refreshDirectory = useCallback(async () => {
    await loadDirectory(currentPath);
  }, [loadDirectory, currentPath]);

  const {
    selectedFiles,
    setSelectedFiles,
    operationMessage,
    setOperationMessage,
    operationError,
    setOperationError,
    toggleSelection,
    handleToggleAllSelections,
    handleSplit,
    handleRenameEntry,
    handleDeleteEntries
  } = useFileOperations({
    getEffectiveRootPath,
    currentPath,
    entries,
    preview,
    onRefreshDirectory: refreshDirectory,
    onClearPreview: clearPreview
  });

  // ─────────────────────────────────────────────────────────────────────────
  // State Restoration (runs once on mount)
  // ─────────────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    const persistedState = initialPersistedState.current;
    if (isInitialMount.current && persistedState && !hasInitialized.current) {
      isInitialMount.current = false;
      
      if (persistedState.entries.length > 0) {
        setEntries(persistedState.entries);
        setBreadcrumbs(persistedState.breadcrumbs);
        setCurrentPath(persistedState.currentPath);
        setPreview(persistedState.preview);
        setSelectedFiles(persistedState.selectedFiles);
        setSelectedProjectId(persistedState.selectedProjectId);
        queueMicrotask(() => {
          hasInitialized.current = true;
        });
      } else if (persistedState.selectedProjectId) {
        setSelectedProjectId(persistedState.selectedProjectId);
        queueMicrotask(() => {
          hasInitialized.current = true;
        });
      } else {
        hasInitialized.current = true;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // State Persistence
  // ─────────────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    if (workspaceId && hasInitialized.current) {
      updateState(workspaceId, {
        entries,
        breadcrumbs,
        currentPath,
        preview,
        selectedFiles,
        selectedProjectId
      });
    }
  }, [workspaceId, entries, breadcrumbs, currentPath, preview, selectedFiles, selectedProjectId, updateState]);

  // ─────────────────────────────────────────────────────────────────────────
  // Load projects on mount
  // ─────────────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-load directory when project changes
  // ─────────────────────────────────────────────────────────────────────────
  
  useEffect(() => {
    if (!hasInitialized.current) return;
    if (activeWorkspace && desktopAvailable && workspaceId && entries.length === 0 && selectedProjectId) {
      void loadDirectory('');
    }
  }, [activeWorkspace, desktopAvailable, workspaceId, selectedProjectId, entries.length, loadDirectory]);

  const prevSelectedProjectId = useRef<string | null>(selectedProjectId);
  
  useEffect(() => {
    if (selectedProjectId && desktopAvailable && projectsLoaded) {
      const isUserChange = prevSelectedProjectId.current !== null && 
                          prevSelectedProjectId.current !== selectedProjectId;
      if (isUserChange) {
        void loadDirectory('');
      }
    }
    prevSelectedProjectId.current = selectedProjectId;
  }, [selectedProjectId, desktopAvailable, projectsLoaded, loadDirectory]);

  // ─────────────────────────────────────────────────────────────────────────
  // Entry click handler
  // ─────────────────────────────────────────────────────────────────────────
  
  const handleEntryClick = useCallback(async (entry: { type: string; path: string }) => {
    if (entry.type === 'directory') {
      await loadDirectory(entry.path);
      return;
    }
    await loadPreview(entry.path);
  }, [loadDirectory, loadPreview]);

  // ─────────────────────────────────────────────────────────────────────────
  // Dialogs state
  // ─────────────────────────────────────────────────────────────────────────
  
  const [payloadDialogOpen, setPayloadDialogOpen] = useState(false);

  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const splitForm = useForm<SplitFormValues>({
    defaultValues: {
      separator: '\\n\\n',
      prefix: '',
      extension: '.txt',
      overwrite: false,
      preserveOriginal: true,
      mode: 'simple',
      sourceMode: 'file'
    }
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ paths: string[]; names: string[] } | null>(null);

  // Project dialog state
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectDialogMode, setProjectDialogMode] = useState<'create' | 'edit'>('create');
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectFormData, setProjectFormData] = useState<ProjectFormData>({ name: '', relativePath: '', description: '' });
  const [projectSaving, setProjectSaving] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Dialog handlers
  // ─────────────────────────────────────────────────────────────────────────
  
  const openSplitDialog = useCallback((fromClipboard = false) => {
    if (!fromClipboard && !preview?.path) return;
    
    if (fromClipboard) {
      splitForm.reset({
        separator: '\n\n',
        prefix: 'extracted',
        extension: '.txt',
        overwrite: false,
        preserveOriginal: true,
        mode: 'boundary',
        sourceMode: 'clipboard'
      });
    } else if (preview) {
      const segments = preview.path.split(/[\\/]/);
      const filename = segments[segments.length - 1] ?? 'file';
      const base = filename.replace(/\.[^.]+$/, '');
      splitForm.reset({
        separator: '\n\n',
        prefix: `${base}-part`,
        extension: filename.includes('.') ? `.${filename.split('.').pop()}` : '.txt',
        overwrite: false,
        preserveOriginal: true,
        mode: 'boundary',
        sourceMode: 'file'
      });
    }
    setSplitDialogOpen(true);
  }, [preview, splitForm]);

  const openDeleteDialog = useCallback((pathsToDelete: string[], names: string[]) => {
    setDeleteTarget({ paths: pathsToDelete, names });
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteSingle = useCallback((entry: { path: string; name: string }) => {
    openDeleteDialog([entry.path], [entry.name]);
  }, [openDeleteDialog]);

  const handleDeleteBulk = useCallback(() => {
    const paths = Array.from(selectedFiles);
    const names = entries
      .filter(e => paths.includes(e.path))
      .map(e => e.name);
    openDeleteDialog(paths, names);
  }, [selectedFiles, entries, openDeleteDialog]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await handleDeleteEntries(deleteTarget.paths);
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  }, [deleteTarget, handleDeleteEntries]);

  // ─────────────────────────────────────────────────────────────────────────
  // Project dialog handlers
  // ─────────────────────────────────────────────────────────────────────────
  
  const openCreateProjectDialog = useCallback(() => {
    setProjectDialogMode('create');
    setProjectToEdit(null);
    setProjectFormData({ name: '', relativePath: '', description: '' });
    setProjectDialogOpen(true);
  }, []);

  const openEditProjectDialog = useCallback(() => {
    if (!selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;
    setProjectDialogMode('edit');
    setProjectToEdit(project);
    setProjectFormData({
      name: project.name,
      relativePath: project.relativePath,
      description: project.description || ''
    });
    setProjectDialogOpen(true);
  }, [selectedProjectId, projects]);

  const handleProjectSave = useCallback(async () => {
    if (!workspaceId) return;
    setProjectSaving(true);
    try {
      const { createWorkspaceProject, updateWorkspaceProject } = await import('@/api/workspaces');
      if (projectDialogMode === 'create') {
        await createWorkspaceProject(workspaceId, projectFormData);
      } else if (projectToEdit) {
        await updateWorkspaceProject(workspaceId, projectToEdit.id, projectFormData);
      }
      await loadProjects();
      setProjectDialogOpen(false);
    } catch (err) {
      console.error('Failed to save project:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setProjectSaving(false);
    }
  }, [workspaceId, projectDialogMode, projectToEdit, projectFormData, loadProjects, setOperationError]);

  const handleProjectDelete = useCallback(async () => {
    if (!workspaceId || !projectToEdit) return;
    if (!confirm('Delete this project? This will not delete files on disk.')) return;
    try {
      const { deleteWorkspaceProject } = await import('@/api/workspaces');
      await deleteWorkspaceProject(workspaceId, projectToEdit.id);
      setSelectedProjectId(null);
      setProjectDialogOpen(false);
      await loadProjects();
      setOperationMessage('Project deleted successfully');
    } catch (err) {
      console.error('Failed to delete project:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  }, [workspaceId, projectToEdit, setSelectedProjectId, loadProjects, setOperationMessage, setOperationError]);

  const handleBrowsePath = useCallback(async () => {
    if (!window.api?.selectDirectory) {
      setOperationError('Desktop bridge unavailable for directory selection.');
      return;
    }
    
    try {
      const result = await window.api.selectDirectory();
      if (!result.canceled && result.path) {
        setProjectFormData(prev => ({ ...prev, relativePath: result.path ?? '' }));
      }
    } catch (err) {
      console.error('Failed to select directory:', err);
      setOperationError('Failed to open directory picker.');
    }
  }, [setOperationError]);

  // ─────────────────────────────────────────────────────────────────────────
  // Save handler with message
  // ─────────────────────────────────────────────────────────────────────────
  
  const handleSaveEdit = useCallback(async () => {
    try {
      await saveEdit();
      setOperationMessage('File saved successfully');
      setTimeout(() => setOperationMessage(null), 3000);
    } catch {
      // Error already set by saveEdit
    }
  }, [saveEdit, setOperationMessage]);

  // ─────────────────────────────────────────────────────────────────────────
  // Split handler
  // ─────────────────────────────────────────────────────────────────────────
  
  const onSplitSubmit = useCallback(async (values: SplitFormValues) => {
    await handleSplit(values);
    setSplitDialogOpen(false);
  }, [handleSplit]);

  // ─────────────────────────────────────────────────────────────────────────
  // Computed values
  // ─────────────────────────────────────────────────────────────────────────
  
  const refreshDisabled = directoryLoading || !desktopAvailable;
  const showEmptyProjectState = !selectedProjectId && projects.length > 0;
  const showNoProjectsState = projects.length === 0 && !projectsLoading;

  // Get selected file info for PayloadDialog
  const selectedFilesInfo = useMemo(() => {
    return entries
      .filter((e) => selectedFiles.has(e.path) && e.type === 'file')
      .map((e) => ({ name: e.name, path: e.path }));
  }, [entries, selectedFiles]);

  // Read file content by path (for PayloadDialog)
  const handleReadFile = useCallback(
    async (filePath: string): Promise<ArrayBuffer> => {
      if (!window.api?.readBinaryFile) {
        throw new Error('Desktop bridge not available');
      }
      const rootPath = getEffectiveRootPath();
      const result = await window.api.readBinaryFile({
        rootPath,
        relativePath: filePath
      });
      if (!result.ok || !result.base64) {
        throw new Error(result.error || 'Failed to read file');
      }
      // Convert base64 to ArrayBuffer
      const binaryString = atob(result.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    },
    [getEffectiveRootPath]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render guards
  // ─────────────────────────────────────────────────────────────────────────
  
  if (!desktopAvailable) {
    return <DesktopOnlyBanner />;
  }

  if (!activeWorkspace) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
        <p>Workspace not found</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────
  
  return (
    <div className="space-y-4">
      {/* Status messages */}
      {directoryError ? <div className="text-sm text-destructive">Error: {directoryError}</div> : null}
      {operationMessage ? <div className="text-sm text-emerald-600">{operationMessage}</div> : null}
      {operationError ? <div className="text-sm text-destructive">{operationError}</div> : null}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <ProjectSelector
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
          onCreateProject={openCreateProjectDialog}
          onEditProject={openEditProjectDialog}
          onRefresh={() => void loadDirectory(currentPath)}
          refreshDisabled={refreshDisabled}
        />

        <FileOperationsToolbar
          selectedCount={selectedFiles.size}
          onTransfer={() => setPayloadDialogOpen(true)}
          onExtract={() => openSplitDialog(true)}
          onDelete={handleDeleteBulk}
          disabled={!desktopAvailable}
        />
      </div>

      {/* Content */}
      {showNoProjectsState ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No projects in this workspace. Create one to start browsing files.</p>
          <Button onClick={openCreateProjectDialog} variant="outline" className="mt-4">
            <AlertCircle className="size-4 mr-2" />
            Create Project
          </Button>
        </div>
      ) : showEmptyProjectState ? (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          <p>Select a project from the dropdown to browse its files.</p>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr,1fr] 2xl:grid-cols-[2fr,1fr]">
          <div className="min-w-0">
            <DirectoryBrowser
              ref={directoryBrowserRef}
              breadcrumbs={breadcrumbs}
              entries={entries}
              selectedFiles={selectedFiles}
              onNavigate={(path) => void loadDirectory(path)}
              onEntryClick={(entry) => void handleEntryClick(entry)}
              onToggleEntrySelection={toggleSelection}
              onToggleAllSelections={handleToggleAllSelections as (state: CheckedState) => void}
              onRenameEntry={handleRenameEntry}
              onDeleteEntry={handleDeleteSingle}
              loading={directoryLoading}
            />
          </div>

          <div className="min-w-0">
            <PreviewPanel
              preview={preview}
              previewError={previewError}
              previewMode={previewMode}
              onModeChange={setPreviewMode}
              editMode={editMode}
              onToggleEditMode={handleToggleEditMode}
              editBuffer={editBuffer}
              onEditBufferChange={setEditBuffer}
              onSave={handleSaveEdit}
              saving={saving}
              binaryPreview={binaryPreview}
              desktopAvailable={desktopAvailable}
              onOpenSplitDialog={() => openSplitDialog(false)}
              mediaPreview={mediaPreview}
              mediaType={mediaType}
            />
          </div>
        </div>
      )}

      {/* Dialogs */}
      <PayloadDialog
        open={payloadDialogOpen}
        onOpenChange={setPayloadDialogOpen}
        selectedFiles={selectedFilesInfo}
        onReadFile={handleReadFile}
      />
      <SplitDialog form={splitForm} open={splitDialogOpen} onOpenChange={setSplitDialogOpen} onSubmit={onSplitSubmit} />
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemCount={deleteTarget?.paths.length || 0}
        itemNames={deleteTarget?.names || []}
        onConfirm={handleDeleteConfirm}
      />

      {/* Project Dialog */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{projectDialogMode === 'create' ? 'Create Project' : 'Edit Project'}</DialogTitle>
            <DialogDescription>
              {projectDialogMode === 'create' 
                ? 'Add a new project to this workspace' 
                : 'Update project details'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                value={projectFormData.name}
                onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                placeholder="My Project"
              />
            </div>
            <div>
              <Label htmlFor="project-path">Path</Label>
              <div className="flex gap-2">
                <Input
                  id="project-path"
                  value={projectFormData.relativePath}
                  onChange={(e) => setProjectFormData({ ...projectFormData, relativePath: e.target.value })}
                  placeholder="C:/path/to/project or relative/path"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleBrowsePath}
                  title="Browse for folder"
                >
                  <FolderOpen className="size-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Use an absolute path (e.g., C:/Users/...) or a path relative to the workspace root.
              </p>
            </div>
            <div>
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={projectFormData.description}
                onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProjectDialogOpen(false)}>
              Cancel
            </Button>
            {projectDialogMode === 'edit' && (
              <Button 
                variant="destructive" 
                onClick={handleProjectDelete}
              >
                <Trash className="size-4 mr-2" />
                Delete Project
              </Button>
            )}
            <Button onClick={handleProjectSave} disabled={projectSaving || !projectFormData.name || !projectFormData.relativePath}>
              {projectSaving ? 'Saving...' : projectDialogMode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
