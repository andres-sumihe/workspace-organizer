import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { WorkspaceSummary } from '@workspace/shared';

import { fetchWorkspaceList } from '@/api/workspaces';

interface WorkspaceContextValue {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  activeWorkspace: WorkspaceSummary | null;
  setActiveWorkspaceId: (id: string | null) => void;
  refreshWorkspaces: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export const WorkspaceProvider = ({ children }: WorkspaceProviderProps) => {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshWorkspaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch a reasonable page size to get all workspaces
      const payload = await fetchWorkspaceList(1, 100);
      setWorkspaces(payload.items);

      // Auto-select first workspace if none selected and list is non-empty
      if (!activeWorkspaceId && payload.items.length > 0) {
        setActiveWorkspaceId(payload.items[0].id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load workspaces';
      setError(message);
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    void refreshWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeWorkspace = useMemo(
    () => workspaces.find((ws) => ws.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  );

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspaceId,
      activeWorkspace,
      setActiveWorkspaceId,
      refreshWorkspaces,
      loading,
      error
    }),
    [workspaces, activeWorkspaceId, activeWorkspace, refreshWorkspaces, loading, error]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspaceContext = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspaceContext must be used within a WorkspaceProvider');
  }
  return context;
};
