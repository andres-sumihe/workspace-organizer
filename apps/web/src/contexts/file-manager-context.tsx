import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

import type { WorkspaceDirectoryEntry, WorkspaceBreadcrumb, WorkspaceFilePreview } from '@/types/desktop';

interface FileManagerState {
  currentPath: string;
  breadcrumbs: WorkspaceBreadcrumb[];
  entries: WorkspaceDirectoryEntry[];
  preview: WorkspaceFilePreview | null;
  selectedFiles: Set<string>;
  workspaceId: string | null;
}

interface FileManagerContextValue {
  state: Record<string, FileManagerState>;
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
  workspaceId: null
});

export const FileManagerProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<Record<string, FileManagerState>>({});

  const getState = useCallback((workspaceId: string): FileManagerState => {
    return state[workspaceId] || createDefaultState();
  }, [state]);

  const updateState = useCallback((workspaceId: string, updates: Partial<FileManagerState>) => {
    setState(prev => ({
      ...prev,
      [workspaceId]: {
        ...prev[workspaceId],
        ...updates,
        workspaceId
      }
    }));
  }, []);

  const clearState = useCallback((workspaceId: string) => {
    setState(prev => {
      const newState = { ...prev };
      delete newState[workspaceId];
      return newState;
    });
  }, []);

  return (
    <FileManagerContext.Provider value={{ state, getState, updateState, clearState }}>
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
