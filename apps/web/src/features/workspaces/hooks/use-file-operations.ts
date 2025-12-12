import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';

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
  setSelectedFiles: Dispatch<SetStateAction<Set<string>>>;
  operationMessage: string | null;
  setOperationMessage: Dispatch<SetStateAction<string | null>>;
  operationError: string | null;
  setOperationError: Dispatch<SetStateAction<string | null>>;
  toggleSelection: (entry: WorkspaceDirectoryEntry) => void;
  handleToggleAllSelections: (checked: boolean | 'indeterminate') => void;
  clearSelection: () => void;
  handleSplit: (values: SplitFormValues) => Promise<void>;
  handleRenameEntry: (entry: WorkspaceDirectoryEntry, newName: string) => Promise<void>;
  handleDeleteEntries: (paths: string[]) => Promise<void>;
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
  const [operationMessage, setOperationMessage] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

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
      await onRefreshDirectory();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to split file';
      setOperationError(message);
    }
  }, [getEffectiveRootPath, preview?.path, currentPath, onRefreshDirectory]);

  const handleRenameEntry = useCallback(async (entry: WorkspaceDirectoryEntry, newName: string) => {
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
      await onRefreshDirectory();

      if (preview?.path === entry.path) {
        onClearPreview();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename';
      setOperationError(message);
      throw err;
    }
  }, [getEffectiveRootPath, preview?.path, onRefreshDirectory, onClearPreview]);

  const handleDeleteEntries = useCallback(async (paths: string[]) => {
    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot || !window.api?.deleteEntries) {
      setOperationError('Desktop bridge unavailable.');
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
        setOperationMessage(
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
      setOperationError(message);
    }
  }, [getEffectiveRootPath, preview, clearSelection, onClearPreview, onRefreshDirectory]);

  return {
    selectedFiles,
    setSelectedFiles,
    operationMessage,
    setOperationMessage,
    operationError,
    setOperationError,
    toggleSelection,
    handleToggleAllSelections,
    clearSelection,
    handleSplit,
    handleRenameEntry,
    handleDeleteEntries
  };
};
