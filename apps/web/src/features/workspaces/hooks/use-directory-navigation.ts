import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';

import type { WorkspaceDirectoryEntry, WorkspaceBreadcrumb } from '@/types/desktop';

interface UseDirectoryNavigationProps {
  getEffectiveRootPath: () => string;
  getRelativePath: (targetPath: string) => { rootPath: string; relativePath: string };
  desktopAvailable: boolean;
  onError?: (message: string) => void;
}

interface UseDirectoryNavigationReturn {
  entries: WorkspaceDirectoryEntry[];
  setEntries: Dispatch<SetStateAction<WorkspaceDirectoryEntry[]>>;
  breadcrumbs: WorkspaceBreadcrumb[];
  setBreadcrumbs: Dispatch<SetStateAction<WorkspaceBreadcrumb[]>>;
  currentPath: string;
  setCurrentPath: Dispatch<SetStateAction<string>>;
  loading: boolean;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  loadDirectory: (targetPath: string) => Promise<void>;
  clearDirectory: () => void;
}

export const useDirectoryNavigation = ({
  getEffectiveRootPath,
  getRelativePath,
  desktopAvailable,
  onError
}: UseDirectoryNavigationProps): UseDirectoryNavigationReturn => {
  const [entries, setEntries] = useState<WorkspaceDirectoryEntry[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<WorkspaceBreadcrumb[]>([{ label: 'Root', path: '' }]);
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearDirectory = useCallback(() => {
    setEntries([]);
    setBreadcrumbs([{ label: 'Root', path: '' }]);
    setCurrentPath('');
  }, []);

  const loadDirectory = useCallback(async (targetPath: string) => {
    if (!desktopAvailable || !window.api?.listDirectory) {
      const errorMsg = 'Desktop file bridge unavailable.';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    const effectiveRoot = getEffectiveRootPath();
    if (!effectiveRoot) {
      clearDirectory();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { rootPath, relativePath } = getRelativePath(targetPath);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read directory';
      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  }, [desktopAvailable, getEffectiveRootPath, getRelativePath, clearDirectory, onError]);

  return {
    entries,
    setEntries,
    breadcrumbs,
    setBreadcrumbs,
    currentPath,
    setCurrentPath,
    loading,
    error,
    setError,
    loadDirectory,
    clearDirectory
  };
};
