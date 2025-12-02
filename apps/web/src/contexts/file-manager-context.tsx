import { createContext, useContext, useCallback, useRef, useMemo, type ReactNode } from 'react';

import type { WorkspaceDirectoryEntry, WorkspaceBreadcrumb, WorkspaceFilePreview } from '@/types/desktop';

interface FileManagerState {
  currentPath: string;
  breadcrumbs: WorkspaceBreadcrumb[];
  entries: WorkspaceDirectoryEntry[];
  preview: WorkspaceFilePreview | null;
  selectedFiles: Set<string>;
  selectedProjectId: string | null;
  workspaceId: string | null;
}

interface FileManagerContextValue {
  getState: (workspaceId: string) => FileManagerState;
  updateState: (workspaceId: string, updates: Partial<FileManagerState>) => void;
  clearState: (workspaceId: string) => void;
}

const FileManagerContext = createContext<FileManagerContextValue | undefined>(undefined);

const createDefaultState = (): FileManagerState => ({
  currentPath: '',
  breadcrumbs: [{ label: 'Root', path: '' }],
  entries: [],
  preview: null,
  selectedFiles: new Set(),
  selectedProjectId: null,
  workspaceId: null
});

export const FileManagerProvider = ({ children }: { children: ReactNode }) => {
  // Use ref to store state - no re-renders when state updates
  const stateRef = useRef<Record<string, FileManagerState>>({});

  const getState = useCallback((workspaceId: string): FileManagerState => {
    return stateRef.current[workspaceId] || createDefaultState();
  }, []);

  const updateState = useCallback((workspaceId: string, updates: Partial<FileManagerState>) => {
    stateRef.current = {
      ...stateRef.current,
      [workspaceId]: {
        ...stateRef.current[workspaceId],
        ...updates,
        workspaceId
      }
    };
    // Don't trigger re-render - this is just for persistence
  }, []);

  const clearState = useCallback((workspaceId: string) => {
    const newState = { ...stateRef.current };
    delete newState[workspaceId];
    stateRef.current = newState;
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    getState,
    updateState,
    clearState
  }), [getState, updateState, clearState]);

  return (
    <FileManagerContext.Provider value={contextValue}>
      {children}
    </FileManagerContext.Provider>
  );
};

export const useFileManagerState = () => {
  const context = useContext(FileManagerContext);
  if (!context) {
    throw new Error('useFileManagerState must be used within FileManagerProvider');
  }
  return context;
};
