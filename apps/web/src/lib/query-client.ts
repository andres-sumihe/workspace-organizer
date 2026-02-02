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

  // Projects domain
  projects: {
    all: ['projects'] as const,
    byWorkspace: (workspaceId: string) => [...queryKeys.projects.all, 'workspace', workspaceId] as const,
    detail: (projectId: string) => [...queryKeys.projects.all, 'detail', projectId] as const,
  },

  // Personal Projects domain
  personalProjects: {
    all: ['personalProjects'] as const,
    list: (params?: Record<string, unknown>) => [...queryKeys.personalProjects.all, 'list', params] as const,
  },

  // Templates domain
  templates: {
    all: ['templates'] as const,
    lists: () => [...queryKeys.templates.all, 'list'] as const,
  },

  // Notes domain
  notes: {
    all: ['notes'] as const,
    list: (params?: Record<string, unknown>) => [...queryKeys.notes.all, 'list', params] as const,
  },

  // Work Logs domain
  workLogs: {
    all: ['workLogs'] as const,
    list: (params?: Record<string, unknown>) => [...queryKeys.workLogs.all, 'list', params] as const,
  },

  // Tools domain
  tools: {
    all: ['tools'] as const,
    overtimeStats: (params?: Record<string, unknown>) => [...queryKeys.tools.all, 'overtime', 'stats', params] as const,
  }
};
