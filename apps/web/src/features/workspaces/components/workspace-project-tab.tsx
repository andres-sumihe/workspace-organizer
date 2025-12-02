import { AlertCircle, Edit2, FolderOpen, GitMerge, Plus, RefreshCw, SplitSquareHorizontal, Trash, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { DeleteConfirmDialog } from './delete-confirm-dialog';
import { DirectoryBrowser, type DirectoryBrowserHandle } from './directory-browser';
import { MergeDialog } from './merge-dialog';
import { PreviewPanel } from './preview-panel';
import { SplitDialog } from './split-dialog';
import { getMediaType, isLikelyBinary, relativeJoin } from '../utils';

import type { MergeFormValues, PreviewMode, SplitFormValues } from '../types';
import type { MediaType } from '../utils';
import type { WorkspaceBreadcrumb, WorkspaceDirectoryEntry, WorkspaceFilePreview, WorkspaceMediaPreview } from '@/types/desktop';
import type { CheckedState } from '@radix-ui/react-checkbox';

import { fetchWorkspaceProjects, createWorkspaceProject, updateWorkspaceProject, deleteWorkspaceProject } from '@/api/workspaces';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFileManagerState } from '@/contexts/file-manager-context';
import { useWorkspaceContext } from '@/contexts/workspace-context';

const DesktopOnlyBanner = () => (
  <div className="flex items-start gap-2 rounded-md border border-dashed border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-400">
    <AlertCircle className="mt-0.5 size-4 shrink-0" />
    <p>
      File management actions require the desktop shell. Launch via <code>npm run dev:desktop</code> to enable browsing,
      merge, and split tools.
    </p>
  </div>
);

interface WorkspaceFilesTabProps {
  workspaceId: string;
}

interface Project {
  id: string;
  name: string;
  relativePath: string;
  description?: string;
}

export const WorkspaceFilesTab = ({ workspaceId }: WorkspaceFilesTabProps) => {
  const { workspaces } = useWorkspaceContext();
  const { getState, updateState } = useFileManagerState();
  
  const activeWorkspace = useMemo(
    () => workspaces.find((ws) => ws.id === workspaceId),
    [workspaceId, workspaces]
  );

  // Get persisted state ONCE on mount using a ref
  const initialPersistedState = useRef<ReturnType<typeof getState> | null>(null);
  if (initialPersistedState.current === null && workspaceId) {
    initialPersistedState.current = getState(workspaceId);
  }
  
  // Track if this is the initial mount to decide whether to restore or fetch
  const isInitialMount = useRef(true);
  const hasInitialized = useRef(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const projectsRef = useRef<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectDialogMode, setProjectDialogMode] = useState<'create' | 'edit'>('create');
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [projectFormData, setProjectFormData] = useState({ name: '', relativePath: '', description: '' });
  const [projectSaving, setProjectSaving] = useState(false);

  // Keep projectsRef in sync
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  // Track if projects have been loaded at least once
  const projectsLoaded = useRef(false);

  // Helper to get the effective root path based on project's path type
  const getEffectiveRootPath = useCallback(() => {
    const selectedProject = projectsRef.current.find(p => p.id === selectedProjectId);
    if (!selectedProject) return activeWorkspace?.rootPath || '';
    
    const projectBasePath = selectedProject.relativePath;
    const isAbsolutePath = /^[a-zA-Z]:[\\/]/.test(projectBasePath) || projectBasePath.startsWith('/');
    
    return isAbsolutePath ? projectBasePath : activeWorkspace?.rootPath || '';
  }, [selectedProjectId, activeWorkspace?.rootPath]);
  
  const [entries, setEntries] = useState<WorkspaceDirectoryEntry[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<WorkspaceBreadcrumb[]>([{ label: 'Root', path: '' }]);
  const [currentPath, setCurrentPath] = useState('');
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);

  const [preview, setPreview] = useState<WorkspaceFilePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('text');
  const [editMode, setEditMode] = useState(false);
  const [editBuffer, setEditBuffer] = useState('');
  const [binaryPreview, setBinaryPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<WorkspaceMediaPreview | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(null);

  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Ref for DirectoryBrowser to update highlight imperatively
  const directoryBrowserRef = useRef<DirectoryBrowserHandle>(null);

  // Update highlight when preview changes (imperatively, no re-render)
  useEffect(() => {
    const activePath = preview?.path || mediaPreview?.path || null;
    directoryBrowserRef.current?.setActiveHighlight(activePath);
  }, [preview?.path, mediaPreview?.path]);

  // Restore state from context on mount (runs once)
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
        // Mark as initialized after a microtask to ensure state is set
        queueMicrotask(() => {
          hasInitialized.current = true;
        });
      } else if (persistedState.selectedProjectId) {
        setSelectedProjectId(persistedState.selectedProjectId);
        queueMicrotask(() => {
          hasInitialized.current = true;
        });
      } else {
        // No persisted state to restore, mark as initialized immediately
        hasInitialized.current = true;
      }
    }
  }, []); // Empty deps - runs once on mount

  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const mergeForm = useForm<MergeFormValues>({
    defaultValues: {
      destination: '',
      separator: '\\n\\n',
      includeHeaders: true,
      overwrite: false,
      mode: 'simple',
      copyToClipboard: false
    }
  });

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

  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [desktopAvailable, setDesktopAvailable] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ paths: string[]; names: string[] } | null>(null);

  useEffect(() => {
    setDesktopAvailable(typeof window !== 'undefined' && typeof window.api?.listDirectory === 'function');
  }, []);

  // Persist state when it changes (but not during initial restore)
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

  const loadDirectory = useCallback(
    async (targetPath: string) => {
      if (!desktopAvailable || !window.api?.listDirectory) {
        setDirectoryError('Desktop file bridge unavailable.');
        return;
      }

      if (!selectedProjectId) {
        setEntries([]);
        setBreadcrumbs([{ label: 'Root', path: '' }]);
        setCurrentPath('');
        return;
      }

      const selectedProject = projectsRef.current.find(p => p.id === selectedProjectId);
      if (!selectedProject) {
        setDirectoryError('Selected project not found.');
        return;
      }

      setDirectoryLoading(true);
      setDirectoryError(null);
      setOperationMessage(null);
      setOperationError(null);

      try {
        const projectBasePath = selectedProject.relativePath;
        // Check if projectBasePath is an absolute path (starts with drive letter or /)
        const isAbsolutePath = /^[a-zA-Z]:[\\/]/.test(projectBasePath) || projectBasePath.startsWith('/');
        
        let rootPath: string;
        let relativePath: string;
        
        if (isAbsolutePath) {
          // Use the absolute path as the root
          rootPath = projectBasePath;
          relativePath = targetPath || '.';
        } else {
          // Use workspace root + relative project path
          rootPath = activeWorkspace?.rootPath || '';
          relativePath = targetPath ? `${projectBasePath}/${targetPath}` : projectBasePath;
        }

        const response = await window.api.listDirectory({
          rootPath,
          relativePath
        });
        
        if (!response.ok || !response.entries || !response.breadcrumbs) {
          throw new Error(response.error || 'Unable to read directory');
        }
        
        setEntries(response.entries);
        setBreadcrumbs(response.breadcrumbs);
        setCurrentPath(response.path ?? relativePath ?? '');
        setSelectedFiles(new Set());
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to read directory';
        setDirectoryError(message);
      } finally {
        setDirectoryLoading(false);
      }
    },
    [activeWorkspace?.rootPath, desktopAvailable, selectedProjectId]
  );

  useEffect(() => {
    // Skip directory load on initial mount - let restore effect handle it
    // Only load if we don't have entries and initialization is complete
    if (!hasInitialized.current) {
      return;
    }
    if (activeWorkspace && desktopAvailable && workspaceId && entries.length === 0 && selectedProjectId) {
      void loadDirectory('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace, desktopAvailable, workspaceId, selectedProjectId]);

  // Track the previous project ID to detect user-initiated changes
  const prevSelectedProjectId = useRef<string | null>(selectedProjectId);
  
  useEffect(() => {
    // Only trigger directory load when user explicitly changes project selection
    // (not on initial mount or navigation back)
    if (selectedProjectId && desktopAvailable && projectsLoaded.current) {
      const isUserChange = prevSelectedProjectId.current !== null && 
                          prevSelectedProjectId.current !== selectedProjectId;
      if (isUserChange) {
        void loadDirectory('');
      }
    }
    prevSelectedProjectId.current = selectedProjectId;
  }, [selectedProjectId, desktopAvailable, loadDirectory]);

  const handleEntryClick = useCallback(async (entry: WorkspaceDirectoryEntry) => {
    if (entry.type === 'directory') {
      await loadDirectory(entry.path);
      return;
    }

    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot) {
      setPreviewError('No root path available for preview.');
      return;
    }

    setPreviewError(null);
    setBinaryPreview(false);

    // Check if it's a media file
    const detectedMediaType = getMediaType(entry.path);
    if (detectedMediaType !== null) {
      if (!window.api?.readBinaryFile) {
        setPreviewError('Desktop bridge unavailable for media preview.');
        setMediaPreview(null);
        setMediaType(null);
        return;
      }
      
      try {
        const response = await window.api.readBinaryFile({
          rootPath: effectiveRoot,
          relativePath: entry.path
        });
        
        if (!response.ok || !response.base64) {
          throw new Error(response.error || 'Unable to load media preview');
        }
        
        // Set all media state together to avoid flicker
        setMediaPreview({
          path: response.path ?? entry.path,
          base64: response.base64,
          mimeType: response.mimeType ?? 'application/octet-stream',
          size: response.size ?? 0
        });
        setMediaType(detectedMediaType);
        setPreviewMode('media');
        setPreview(null);
        setEditMode(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to preview media file';
        setPreviewError(message);
        setMediaPreview(null);
        setMediaType(null);
      }
      return;
    }
    
    // Not a media file - clear media state
    setMediaPreview(null);
    setMediaType(null);
    
    if (isLikelyBinary(entry.path)) {
      setBinaryPreview(true);
      setPreview(null);
      return;
    }

    if (!window.api?.readTextFile) {
      setPreviewError('Desktop bridge unavailable for preview.');
      return;
    }

    try {
      const response = await window.api.readTextFile({
        rootPath: effectiveRoot,
        relativePath: entry.path,
        maxBytes: 512 * 1024
      });
      
      if (!response.ok || typeof response.content !== 'string') {
        throw new Error(response.error || 'Unable to load file preview');
      }
      
      setPreview({
        path: response.path ?? entry.path,
        content: response.content,
        truncated: Boolean(response.truncated),
        size: response.size ?? 0
      });
      setPreviewMode('text');
      setEditMode(false);
      setEditBuffer(response.content);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to preview file';
      setPreviewError(message);
    }
  }, [loadDirectory, getEffectiveRootPath]);

  const handleToggleEditMode = () => {
    setEditMode((mode) => {
      const next = !mode;
      if (next && preview) {
        setEditBuffer(preview.content);
      }
      return next;
    });
  };

  const toggleSelection = (entry: WorkspaceDirectoryEntry) => {
    if (entry.type !== 'file') return;
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(entry.path)) {
        next.delete(entry.path);
      } else {
        next.add(entry.path);
      }
      return next;
    });
  };

  const handleToggleAllSelections = (checked: CheckedState) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (checked) {
        entries.forEach((entry) => {
          if (entry.type === 'file') next.add(entry.path);
        });
      } else {
        entries.forEach((entry) => {
          if (entry.type === 'file') next.delete(entry.path);
        });
      }
      return next;
    });
  };

  const handleSaveEdit = useCallback(async () => {
    const effectiveRoot = getEffectiveRootPath();
    if (!editMode || !preview || !effectiveRoot || !window.api?.writeTextFile) return;
    
    setSaving(true);
    try {
      const resp = await window.api.writeTextFile({
        rootPath: effectiveRoot,
        relativePath: preview.path,
        content: editBuffer
      });
      if (!resp.ok) {
        throw new Error(resp.error || 'Failed to save file');
      }
      setPreview((prev) => (prev ? { ...prev, content: editBuffer } : prev));
      setEditMode(false);
      setOperationMessage('File saved successfully');
      setTimeout(() => setOperationMessage(null), 3000);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setSaving(false);
    }
  }, [editMode, preview, getEffectiveRootPath, editBuffer]);

  const openMergeDialog = () => {
    const defaultDestination = relativeJoin(currentPath, `merged-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
    const currentMode = mergeForm.getValues('mode') || 'simple';
    mergeForm.reset({
      destination: defaultDestination,
      separator: '\n\n',
      includeHeaders: currentMode === 'simple',
      overwrite: false,
      mode: currentMode,
      copyToClipboard: currentMode === 'boundary'
    });
    setMergeDialogOpen(true);
  };

  const openSplitDialog = (fromClipboard = false) => {
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
  };

  const handleMerge = async (values: MergeFormValues) => {
    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot || !window.api?.mergeTextFiles) {
      setOperationError('Desktop bridge unavailable.');
      return;
    }

    const sources = Array.from(selectedFiles);
    if (sources.length < 2) {
      setOperationError('Select at least two files to merge.');
      return;
    }

    try {
      const response = await window.api.mergeTextFiles({
        rootPath: effectiveRoot,
        sources,
        destination: values.destination,
        separator: values.separator,
        includeHeaders: values.includeHeaders,
        overwrite: values.overwrite,
        mode: values.mode,
        copyToClipboard: values.copyToClipboard
      });
      
      if (!response.ok || !response.destination) {
        throw new Error(response.error || 'Merge failed');
      }
      
      let message = `Merged into ${response.destination}`;
      if (values.copyToClipboard) {
        message += ' (content copied to clipboard)';
      }
      setOperationMessage(message);
      setSelectedFiles(new Set());
      setMergeDialogOpen(false);
      await loadDirectory(currentPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to merge files';
      setOperationError(message);
    }
  };

  const handleSplit = async (values: SplitFormValues) => {
    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot || !window.api?.splitTextFile) {
      setOperationError('Desktop bridge unavailable.');
      return;
    }

    try {
      let clipboardContent: string | undefined;
      
      if (values.sourceMode === 'clipboard') {
        try {
          clipboardContent = await navigator.clipboard.readText();
          if (!clipboardContent || !clipboardContent.trim()) {
            throw new Error('Clipboard is empty');
          }
          
          if (values.mode === 'boundary') {
            if (!clipboardContent.includes('---FILE-BOUNDARY---|')) {
              throw new Error(
                'Clipboard does not contain boundary-formatted content. ' +
                'Please merge files with "Boundary" mode first and copy the result.'
              );
            }
          }
        } catch (err) {
          if (err instanceof Error) {
            throw err;
          }
          throw new Error('Failed to read clipboard. Please ensure clipboard permissions are granted.');
        }
      } else if (!preview?.path) {
        setOperationError('No file selected for splitting.');
        return;
      }

      const response = await window.api.splitTextFile({
        rootPath: effectiveRoot,
        source: values.sourceMode === 'file' ? preview?.path : undefined,
        clipboardContent: values.sourceMode === 'clipboard' ? clipboardContent : undefined,
        separator: values.separator,
        prefix: values.prefix,
        extension: values.extension,
        overwrite: values.overwrite,
        preserveOriginal: values.preserveOriginal,
        mode: values.mode,
        outputDir: currentPath
      });
      
      if (!response.ok || !response.created) {
        throw new Error(response.error || 'Split failed');
      }
      
      const message = values.sourceMode === 'clipboard' 
        ? `Extracted ${response.created.length} files from clipboard`
        : `Created ${response.created.length} files`;
      setOperationMessage(message);
      setSplitDialogOpen(false);
      await loadDirectory(currentPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to split file';
      setOperationError(message);
    }
  };

  const handleRenameEntry = async (entry: WorkspaceDirectoryEntry, newName: string) => {
    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot || !window.api?.renameEntry) {
      setOperationError('Desktop bridge unavailable.');
      throw new Error('Desktop bridge unavailable');
    }

    try {
      const response = await window.api.renameEntry({
        rootPath: effectiveRoot,
        oldRelativePath: entry.path,
        newName
      });

      if (!response.ok) {
        throw new Error(response.error || 'Rename failed');
      }

      setOperationMessage(`Renamed to ${newName}`);
      await loadDirectory(currentPath);

      if (preview?.path === entry.path) {
        setPreview(null);
        setPreviewError(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename';
      setOperationError(message);
      throw err;
    }
  };

  const openDeleteDialog = (pathsToDelete: string[], names: string[]) => {
    setDeleteTarget({ paths: pathsToDelete, names });
    setDeleteDialogOpen(true);
  };

  const handleDeleteSingle = (entry: WorkspaceDirectoryEntry) => {
    openDeleteDialog([entry.path], [entry.name]);
  };

  const handleDeleteBulk = () => {
    const paths = Array.from(selectedFiles);
    const names = entries
      .filter(e => paths.includes(e.path))
      .map(e => e.name);
    openDeleteDialog(paths, names);
  };

  const handleDeleteConfirm = async () => {
    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot || !window.api?.deleteEntries || !deleteTarget) {
      setOperationError('Desktop bridge unavailable.');
      return;
    }

    try {
      const response = await window.api.deleteEntries({
        rootPath: effectiveRoot,
        relativePaths: deleteTarget.paths
      });

      if (!response.ok) {
        throw new Error(response.error || 'Delete failed');
      }

      const deletedCount = response.deleted?.length || 0;
      const errorCount = response.errors?.length || 0;

      if (deletedCount > 0) {
        setOperationMessage(
          `Deleted ${deletedCount} item${deletedCount > 1 ? 's' : ''}` +
          (errorCount > 0 ? ` (${errorCount} failed)` : '')
        );
      }

      if (errorCount > 0 && deletedCount === 0) {
        throw new Error(`Failed to delete all items`);
      }

      setSelectedFiles(new Set());
      if (preview && deleteTarget.paths.includes(preview.path)) {
        setPreview(null);
        setPreviewError(null);
      }

      await loadDirectory(currentPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete';
      setOperationError(message);
    }
  };

  const loadProjects = useCallback(async () => {
    if (!workspaceId) return;
    setProjectsLoading(true);
    try {
      const response = await fetchWorkspaceProjects(workspaceId);
      const projectsList = response?.projects || [];
      setProjects(projectsList);
      // Update ref immediately so loadDirectory can use it
      projectsRef.current = projectsList;
      
      // Determine which project to select
      const currentSelectedId = selectedProjectId;
      let finalProjectId: string | null = null;
      
      if (currentSelectedId) {
        const projectExists = projectsList.some(p => p.id === currentSelectedId);
        if (projectExists) {
          finalProjectId = currentSelectedId;
        } else if (projectsList.length > 0) {
          finalProjectId = projectsList[0].id;
          setSelectedProjectId(finalProjectId);
        } else {
          setSelectedProjectId(null);
        }
      } else if (projectsList.length > 0) {
        finalProjectId = projectsList[0].id;
        setSelectedProjectId(finalProjectId);
      }
      
      // After projects are loaded, load directory only if we don't have entries already
      // (entries would be restored from context or need fresh load)
      if (finalProjectId && desktopAvailable && entries.length === 0) {
        // Small delay to ensure state is settled
        setTimeout(() => void loadDirectory(''), 0);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      setProjects([]);
      setOperationError('Failed to load projects. The API endpoint may not be implemented yet.');
    } finally {
      setProjectsLoading(false);
      projectsLoaded.current = true;
    }
  }, [workspaceId, desktopAvailable, loadDirectory, selectedProjectId, entries.length]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const openCreateProjectDialog = () => {
    setProjectDialogMode('create');
    setProjectToEdit(null);
    setProjectFormData({ name: '', relativePath: '', description: '' });
    setProjectDialogOpen(true);
  };

  const openEditProjectDialog = () => {
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
  };

  const handleProjectSave = async () => {
    if (!workspaceId) return;
    setProjectSaving(true);
    try {
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
  };

  const handleProjectDelete = async () => {
    if (!workspaceId || !projectToEdit) return;
    if (!confirm('Delete this project? This will not delete files on disk.')) return;
    try {
      await deleteWorkspaceProject(workspaceId, projectToEdit.id);
      setSelectedProjectId(null);
      setProjectDialogOpen(false);
      await loadProjects();
      setOperationMessage('Project deleted successfully');
    } catch (err) {
      console.error('Failed to delete project:', err);
      setOperationError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const handleBrowsePath = async () => {
    if (!window.api?.selectDirectory) {
      setOperationError('Desktop bridge unavailable for directory selection.');
      return;
    }
    
    try {
      const result = await window.api.selectDirectory();
      if (!result.canceled && result.path) {
        setProjectFormData({ ...projectFormData, relativePath: result.path });
      }
    } catch (err) {
      console.error('Failed to select directory:', err);
      setOperationError('Failed to open directory picker.');
    }
  };

  const canMerge = selectedFiles.size >= 2 && desktopAvailable;
  const refreshDisabled = directoryLoading || !desktopAvailable;

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

  const showEmptyProjectState = !selectedProjectId && projects.length > 0;
  const showNoProjectsState = projects.length === 0 && !projectsLoading;

  return (
    <div className="space-y-4">
      {directoryError ? <div className="text-sm text-destructive">Error: {directoryError}</div> : null}
      {operationMessage ? <div className="text-sm text-emerald-600">{operationMessage}</div> : null}
      {operationError ? <div className="text-sm text-destructive">{operationError}</div> : null}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={selectedProjectId || undefined} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="h-10 w-60">
              <SelectValue placeholder="Select a project...">
                {selectedProjectId ? projects.find(p => p.id === selectedProjectId)?.name : 'Select a project...'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {projects?.length > 0 ? (
                projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))
              ) : null}
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2 rounded-md border border-border/40 p-1">
            <Button 
              onClick={openCreateProjectDialog} 
              variant="ghost" 
              size="sm"
              className="h-8 gap-2 px-3"
            >
              <Plus className="size-4" />
              <span>New Project</span>
            </Button>
            <Button 
              onClick={openEditProjectDialog} 
              disabled={!selectedProjectId} 
              variant="ghost" 
              size="sm"
              className="h-8 gap-2 px-3"
            >
              <Edit2 className="size-4" />
              <span>Edit</span>
            </Button>
            <Button
              onClick={() => void loadDirectory(currentPath)}
              disabled={refreshDisabled}
              variant="ghost"
              size="sm"
              className="h-8 gap-2 px-3"
            >
              <RefreshCw className="size-4" />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          
          <div className="flex items-center gap-2 rounded-md border border-border/40 p-1">
            <Button
              onClick={openMergeDialog}
              disabled={!canMerge}
              variant="ghost"
              size="sm"
              className="h-8 gap-2 px-3"
            >
              <GitMerge className="size-4" />
              <span>Merge</span>
              {selectedFiles.size > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  {selectedFiles.size}
                </span>
              )}
            </Button>
            <Button
              onClick={() => openSplitDialog(true)}
              disabled={!desktopAvailable}
              variant="ghost"
              size="sm"
              className="h-8 gap-2 px-3"
            >
              <SplitSquareHorizontal className="size-4" />
              <span>Extract</span>
            </Button>
            <Button
              onClick={handleDeleteBulk}
              disabled={selectedFiles.size === 0 || !desktopAvailable}
              variant="ghost"
              size="sm"
              className="h-8 gap-2 px-3 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
              <span>Delete</span>
              {selectedFiles.size > 0 && (
                <span className="ml-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-xs font-medium">
                  {selectedFiles.size}
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>

      {showNoProjectsState ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No projects in this workspace. Create one to start browsing files.</p>
          <Button onClick={openCreateProjectDialog} variant="outline" className="mt-4">
            <Plus className="size-4 mr-2" />
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
              onNavigate={(path) => {
                void loadDirectory(path);
              }}
              onEntryClick={(entry) => {
                void handleEntryClick(entry);
              }}
              onToggleEntrySelection={toggleSelection}
              onToggleAllSelections={handleToggleAllSelections}
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

      <MergeDialog form={mergeForm} open={mergeDialogOpen} onOpenChange={setMergeDialogOpen} onSubmit={handleMerge} />
      <SplitDialog form={splitForm} open={splitDialogOpen} onOpenChange={setSplitDialogOpen} onSubmit={handleSplit} />
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        itemCount={deleteTarget?.paths.length || 0}
        itemNames={deleteTarget?.names || []}
        onConfirm={handleDeleteConfirm}
      />

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
