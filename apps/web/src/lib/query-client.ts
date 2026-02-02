import { QueryClient } from '@tanstack/react-query';

/**
 * Global QueryClient configuration for TanStack Query
 * 
 * Optimized for desktop Electron app:
 * - staleTime: 60 seconds - reduces unnecessary refetches for desktop usage
 * - gcTime: 10 minutes - longer cache for offline-capable desktop app
 * - refetchOnWindowFocus: false - desktop apps don't benefit from this
 * - refetchOnReconnect: true - important for network recovery
 * - retry: 2 attempts on failure with exponential backoff
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 60 seconds - data stays fresh longer
      gcTime: 10 * 60 * 1000, // 10 minutes - keep unused data in cache
      refetchOnWindowFocus: false, // Desktop app doesn't need this
      refetchOnReconnect: true, // Re-fetch when network recovers
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: 1,
    },
  },
});

/**
 * Query key factory for consistent cache key management
 * Following TanStack Query best practices for key hierarchy
 * 
 * Structure: [domain, scope, ...params]
 * - all: Base key for the domain (used for broad invalidation)
 * - lists/list: For list queries with optional filters
 * - details/detail: For single item queries
 */
export const queryKeys = {
  // Scripts domain
  scripts: {
    all: ['scripts'] as const,
    lists: () => [...queryKeys.scripts.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.scripts.lists(), filters] as const,
    details: () => [...queryKeys.scripts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.scripts.details(), id] as const,
    stats: () => [...queryKeys.scripts.all, 'stats'] as const,
    tags: () => [...queryKeys.scripts.all, 'tags'] as const,
    conflicts: () => [...queryKeys.scripts.all, 'conflicts'] as const,
    driveAnalysis: () => [...queryKeys.scripts.all, 'drive-analysis'] as const,
    activity: (scriptId: string, page: number) => [...queryKeys.scripts.all, 'activity', scriptId, page] as const,
  },

  // Jobs domain
  jobs: {
    all: ['jobs'] as const,
    lists: () => [...queryKeys.jobs.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.jobs.lists(), filters] as const,
    details: () => [...queryKeys.jobs.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.jobs.details(), id] as const,
    stats: () => [...queryKeys.jobs.all, 'stats'] as const,
  },

  // Workspaces domain
  workspaces: {
    all: ['workspaces'] as const,
    lists: () => [...queryKeys.workspaces.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.workspaces.lists(), filters] as const,
    details: () => [...queryKeys.workspaces.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.workspaces.details(), id] as const,
  },

  // Workspace Projects domain (within a workspace)
  projects: {
    all: ['projects'] as const,
    byWorkspace: (workspaceId: string) => [...queryKeys.projects.all, 'workspace', workspaceId] as const,
    detail: (projectId: string) => [...queryKeys.projects.all, 'detail', projectId] as const,
  },

  // Personal Projects domain
  personalProjects: {
    all: ['personalProjects'] as const,
    lists: () => [...queryKeys.personalProjects.all, 'list'] as const,
    list: (params?: Record<string, unknown>) => [...queryKeys.personalProjects.lists(), params] as const,
    details: () => [...queryKeys.personalProjects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.personalProjects.details(), id] as const,
  },

  // Templates domain
  templates: {
    all: ['templates'] as const,
    lists: () => [...queryKeys.templates.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.templates.lists(), filters] as const,
  },

  // Notes domain
  notes: {
    all: ['notes'] as const,
    lists: () => [...queryKeys.notes.all, 'list'] as const,
    list: (params?: Record<string, unknown>) => [...queryKeys.notes.lists(), params] as const,
    details: () => [...queryKeys.notes.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.notes.details(), id] as const,
  },

  // Work Logs domain (Journal)
  workLogs: {
    all: ['workLogs'] as const,
    lists: () => [...queryKeys.workLogs.all, 'list'] as const,
    list: (params?: Record<string, unknown>) => [...queryKeys.workLogs.lists(), params] as const,
    details: () => [...queryKeys.workLogs.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.workLogs.details(), id] as const,
  },

  // Tags domain (shared across features)
  tags: {
    all: ['tags'] as const,
    lists: () => [...queryKeys.tags.all, 'list'] as const,
    list: () => [...queryKeys.tags.lists()] as const,
  },

  // Overtime domain (Tools)
  overtime: {
    all: ['overtime'] as const,
    lists: () => [...queryKeys.overtime.all, 'list'] as const,
    list: (params?: Record<string, unknown>) => [...queryKeys.overtime.lists(), params] as const,
    stats: (params?: Record<string, unknown>) => [...queryKeys.overtime.all, 'stats', params] as const,
  },

  // Settings domain
  settings: {
    all: ['settings'] as const,
    toolsGeneral: () => [...queryKeys.settings.all, 'tools', 'general'] as const,
  },

  // Vault domain (Credentials)
  vault: {
    all: ['vault'] as const,
    status: () => [...queryKeys.vault.all, 'status'] as const,
    credentials: () => [...queryKeys.vault.all, 'credentials'] as const,
    credentialList: (params?: Record<string, unknown>) => [...queryKeys.vault.credentials(), 'list', params] as const,
  },
};
