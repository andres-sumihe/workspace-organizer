import { useState, useCallback } from 'react';
import { toast } from 'sonner';

import { markCutMode, clearCutMode, isCutMode } from '../stores/clipboard-store';

import type { SplitFormValues } from '../types';
import type { WorkspaceDirectoryEntry, WorkspaceFilePreview } from '@/types/desktop';

interface UseFileOperationsProps {
  getEffectiveRootPath: () => string;
  currentPath: string;
  entries: WorkspaceDirectoryEntry[];
  preview: WorkspaceFilePreview | null;
  onRefreshDirectory: () => Promise<void>;
  onClearPreview: () => void;
}

interface UseFileOperationsReturn {
  selectedFiles: Set<string>;
  setSelectedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleSelection: (entry: WorkspaceDirectoryEntry) => void;
  handleToggleAllSelections: (checked: boolean | 'indeterminate') => void;
  clearSelection: () => void;
  handleSplit: (values: SplitFormValues) => Promise<void>;
  handleRenameEntry: (entry: WorkspaceDirectoryEntry, newName: string) => Promise<void>;
  handleDeleteEntries: (paths: string[]) => Promise<void>;
  handleCopy: (paths?: string[]) => Promise<void>;
  handleCut: (paths?: string[]) => Promise<void>;
  handlePaste: () => Promise<void>;
  handleCreateFolder: (name: string) => Promise<void>;
  handleCreateFile: (name: string, content?: string) => Promise<void>;
  handleRevealInExplorer: (relativePath?: string) => Promise<void>;
  handleOpenInVSCode: (relativePath?: string) => Promise<void>;
  handleDuplicate: (entry: WorkspaceDirectoryEntry) => Promise<void>;
  handleImportExternalFiles: (externalPaths: string[]) => Promise<void>;
  handleArchive: (paths?: string[]) => Promise<void>;
  handleExtract: (archivePath: string) => Promise<void>;
}

export const useFileOperations = ({
  getEffectiveRootPath,
  currentPath,
  entries,
  preview,
  onRefreshDirectory,
  onClearPreview
}: UseFileOperationsProps): UseFileOperationsReturn => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set());
  }, []);

  const toggleSelection = useCallback((entry: WorkspaceDirectoryEntry) => {
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
  }, []);

  const handleToggleAllSelections = useCallback((checked: boolean | 'indeterminate') => {
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
  }, [entries]);

  const handleSplit = useCallback(async (values: SplitFormValues) => {
    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot || !window.api?.splitTextFile) {
      toast.error('Desktop bridge unavailable.');
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
        toast.error('No file selected for splitting.');
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
      toast.success(message);
      await onRefreshDirectory();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to split file';
      toast.error(message);
    }
  }, [getEffectiveRootPath, preview?.path, currentPath, onRefreshDirectory]);

  const handleRenameEntry = useCallback(async (entry: WorkspaceDirectoryEntry, newName: string) => {
    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot || !window.api?.renameEntry) {
      toast.error('Desktop bridge unavailable.');
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

      toast.success(`Renamed to ${newName}`);
      await onRefreshDirectory();

      if (preview?.path === entry.path) {
        onClearPreview();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename';
      toast.error(message);
      throw err;
    }
  }, [getEffectiveRootPath, preview?.path, onRefreshDirectory, onClearPreview]);

  const handleDeleteEntries = useCallback(async (paths: string[]) => {
    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot || !window.api?.deleteEntries) {
      toast.error('Desktop bridge unavailable.');
      return;
    }

    try {
      const response = await window.api.deleteEntries({
        rootPath: effectiveRoot,
        relativePaths: paths
      });

      if (!response.ok) {
        throw new Error(response.error || 'Delete failed');
      }

      const deletedCount = response.deleted?.length || 0;
      const errorCount = response.errors?.length || 0;

      if (deletedCount > 0) {
        toast.success(
          `Deleted ${deletedCount} item${deletedCount > 1 ? 's' : ''}` +
          (errorCount > 0 ? ` (${errorCount} failed)` : '')
        );
      }

      if (errorCount > 0 && deletedCount === 0) {
        throw new Error('Failed to delete all items');
      }

      clearSelection();
      if (preview && paths.includes(preview.path)) {
        onClearPreview();
      }

      await onRefreshDirectory();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete';
      toast.error(message);
    }
  }, [getEffectiveRootPath, preview, clearSelection, onClearPreview, onRefreshDirectory]);

  // ─── Copy / Cut / Paste (unified via system clipboard) ────────────────

  const handleCopy = useCallback(async (paths?: string[]) => {
    const pathsToCopy = paths ?? Array.from(selectedFiles);
    if (pathsToCopy.length === 0) return;
    const root = getEffectiveRootPath();
    if (!root || !window.api?.setClipboardFilePaths) return;

    const absolutePaths = pathsToCopy.map(p => `${root}/${p}`);
    const result = await window.api.setClipboardFilePaths(absolutePaths);
    if (!result.ok) {
      toast.error(result.error || 'Failed to copy to clipboard');
      return;
    }
    clearCutMode();
    // Notify useCanPaste to re-check
    window.dispatchEvent(new Event('app-clipboard-changed'));
    toast.success(`${pathsToCopy.length} item${pathsToCopy.length > 1 ? 's' : ''} copied`);
  }, [selectedFiles, getEffectiveRootPath]);

  const handleCut = useCallback(async (paths?: string[]) => {
    const pathsToCut = paths ?? Array.from(selectedFiles);
    if (pathsToCut.length === 0) return;
    const root = getEffectiveRootPath();
    if (!root || !window.api?.setClipboardFilePaths) return;

    const absolutePaths = pathsToCut.map(p => `${root}/${p}`);
    const result = await window.api.setClipboardFilePaths(absolutePaths);
    if (!result.ok) {
      toast.error(result.error || 'Failed to cut to clipboard');
      return;
    }
    markCutMode();
    // Notify useCanPaste to re-check
    window.dispatchEvent(new Event('app-clipboard-changed'));
    toast.success(`${pathsToCut.length} item${pathsToCut.length > 1 ? 's' : ''} cut`);
  }, [selectedFiles, getEffectiveRootPath]);

  const handlePaste = useCallback(async () => {
    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot) {
      toast.error('No workspace root path configured.');
      return;
    }
    if (!window.api?.readClipboardFilePaths || !window.api?.importExternalFiles) {
      toast.error('Desktop bridge unavailable.');
      return;
    }

    try {
      const clipResult = await window.api.readClipboardFilePaths();
      if (!clipResult.ok || !clipResult.paths || clipResult.paths.length === 0) {
        return; // nothing to paste — button should have been disabled
      }

      const shouldMove = isCutMode();

      const response = await window.api.importExternalFiles({
        rootPath: effectiveRoot,
        destinationDir: currentPath,
        externalPaths: clipResult.paths,
        ...(shouldMove && { move: true }),
      });

      if (!response.ok) throw new Error(response.error || 'Paste failed');

      const count = response.imported?.length || 0;
      if (count > 0) {
        toast.success(
          shouldMove
            ? `Moved ${count} item${count > 1 ? 's' : ''}`
            : `Pasted ${count} item${count > 1 ? 's' : ''}`
        );
      } else {
        toast.warning('Nothing was pasted — files may have been moved or deleted.');
      }

      // After a cut-paste, clear cut mode so re-paste copies instead of moving again
      if (shouldMove) {
        clearCutMode();
      }

      clearSelection();
      await onRefreshDirectory();
      // Re-check clipboard state
      window.dispatchEvent(new Event('app-clipboard-changed'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Paste operation failed');
    }
  }, [getEffectiveRootPath, currentPath, clearSelection, onRefreshDirectory]);

  // ─── Create File / Folder ────────────────────────────────────────────

  const handleCreateFolder = useCallback(async (name: string) => {
    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot || !window.api?.createDirectory) {
      toast.error('Desktop bridge unavailable.');
      return;
    }

    try {
      const relativePath = currentPath ? `${currentPath}/${name}` : name;
      const response = await window.api.createDirectory({
        rootPath: effectiveRoot,
        relativePath,
      });
      if (!response.ok) throw new Error(response.error || 'Failed to create folder');
      toast.success(`Folder "${name}" created`);
      await onRefreshDirectory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create folder');
      throw err;
    }
  }, [getEffectiveRootPath, currentPath, onRefreshDirectory]);

  const handleCreateFile = useCallback(async (name: string, content?: string) => {
    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot || !window.api?.writeTextFile) {
      toast.error('Desktop bridge unavailable.');
      return;
    }

    try {
      const relativePath = currentPath ? `${currentPath}/${name}` : name;
      const response = await window.api.writeTextFile({
        rootPath: effectiveRoot,
        relativePath,
        content: content || '',
      });
      if (!response.ok) throw new Error(response.error || 'Failed to create file');
      toast.success(`File "${name}" created`);
      await onRefreshDirectory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create file');
      throw err;
    }
  }, [getEffectiveRootPath, currentPath, onRefreshDirectory]);

  // ─── Reveal in Explorer / Open in VS Code ──────────────────────────

  const handleRevealInExplorer = useCallback(async (relativePath?: string) => {
    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot || !window.api?.revealInExplorer) {
      toast.error('Desktop bridge unavailable.');
      return;
    }

    try {
      const response = await window.api.revealInExplorer({
        rootPath: effectiveRoot,
        relativePath: relativePath || currentPath,
      });
      if (!response.ok) throw new Error(response.error || 'Failed to reveal in explorer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reveal in explorer');
    }
  }, [getEffectiveRootPath, currentPath]);

  const handleOpenInVSCode = useCallback(async (relativePath?: string) => {
    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot || !window.api?.openInVSCode) {
      toast.error('Desktop bridge unavailable.');
      return;
    }

    try {
      const response = await window.api.openInVSCode({
        rootPath: effectiveRoot,
        relativePath: relativePath || currentPath,
      });
      if (!response.ok) throw new Error(response.error || 'Failed to open in VS Code');
      toast.success('Opened in VS Code');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open in VS Code');
    }
  }, [getEffectiveRootPath, currentPath]);

  // ─── Duplicate ────────────────────────────────────────────────────────

  const handleDuplicate = useCallback(async (entry: WorkspaceDirectoryEntry) => {
    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot || !window.api?.copyEntries) {
      toast.error('Desktop bridge unavailable.');
      return;
    }

    try {
      // Copy to same directory (auto-numbering handles conflicts)
      const parentDir = entry.path.includes('/') ? entry.path.substring(0, entry.path.lastIndexOf('/')) : '';
      const response = await window.api.copyEntries({
        rootPath: effectiveRoot,
        relativePaths: [entry.path],
        destinationDir: parentDir,
      });
      if (!response.ok) throw new Error(response.error || 'Failed to duplicate');
      toast.success(`Duplicated "${entry.name}"`);
      await onRefreshDirectory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate');
    }
  }, [getEffectiveRootPath, onRefreshDirectory]);

  // ─── Import external files (drag & drop from outside) ─────────────────

  const handleImportExternalFiles = useCallback(async (externalPaths: string[]) => {
    if (externalPaths.length === 0) return;

    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot || !window.api?.importExternalFiles) {
      toast.error('Desktop bridge unavailable.');
      return;
    }

    try {
      const response = await window.api.importExternalFiles({
        rootPath: effectiveRoot,
        destinationDir: currentPath,
        externalPaths,
      });
      if (!response.ok) throw new Error(response.error || 'Import failed');
      const importedCount = response.imported?.length || 0;
      const errorCount = response.errors?.length || 0;
      if (errorCount > 0) {
        toast.success(`Imported ${importedCount} item${importedCount > 1 ? 's' : ''} (${errorCount} failed)`);
      } else {
        toast.success(`Imported ${importedCount} item${importedCount > 1 ? 's' : ''}`);
      }
      await onRefreshDirectory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import files');
    }
  }, [getEffectiveRootPath, currentPath, onRefreshDirectory]);

  // ─── Archive (Compress to ZIP) ────────────────────────────────────────

  const handleArchive = useCallback(async (paths?: string[]) => {
    const pathsToArchive = paths ?? Array.from(selectedFiles);
    if (pathsToArchive.length === 0) {
      toast.error('No files selected for archiving.');
      return;
    }

    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot || !window.api?.archiveEntries) {
      toast.error('Desktop bridge unavailable.');
      return;
    }

    try {
      // Derive archive name from the first entry
      const firstName = pathsToArchive[0].split('/').pop() || 'archive';
      const baseName = pathsToArchive.length === 1
        ? firstName.replace(/\.[^.]+$/, '')
        : 'archive';
      const archiveName = `${baseName}.zip`;

      const response = await window.api.archiveEntries({
        rootPath: effectiveRoot,
        relativePaths: pathsToArchive,
        archiveName,
      });

      if (!response.ok) throw new Error(response.error || 'Archive creation failed');
      toast.success(`Created ${response.archivePath}`);
      await onRefreshDirectory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create archive');
    }
  }, [selectedFiles, getEffectiveRootPath, onRefreshDirectory]);

  // ─── Extract Archive ──────────────────────────────────────────────────

  const handleExtract = useCallback(async (archivePath: string) => {
    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot || !window.api?.extractArchive) {
      toast.error('Desktop bridge unavailable.');
      return;
    }

    try {
      const response = await window.api.extractArchive({
        rootPath: effectiveRoot,
        archiveRelPath: archivePath,
      });

      if (!response.ok) throw new Error(response.error || 'Extraction failed');
      toast.success(`Extracted to ${response.extractedTo}`);
      await onRefreshDirectory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to extract archive');
    }
  }, [getEffectiveRootPath, onRefreshDirectory]);

  return {
    selectedFiles,
    setSelectedFiles,
    toggleSelection,
    handleToggleAllSelections,
    clearSelection,
    handleSplit,
    handleRenameEntry,
    handleDeleteEntries,
    handleCopy,
    handleCut,
    handlePaste,
    handleCreateFolder,
    handleCreateFile,
    handleRevealInExplorer,
    handleOpenInVSCode,
    handleDuplicate,
    handleImportExternalFiles,
    handleArchive,
    handleExtract,
  };
};
