import { QueryClient } from '@tanstack/react-query';

/**
 * Global QueryClient configuration for TanStack Query
 * 
 * Caching strategy:
 * - staleTime: 30 seconds - data is considered fresh for 30s (won't refetch)
 * - gcTime: 5 minutes - cached data is kept in memory for 5 min after becoming unused
 * - refetchOnWindowFocus: only when data is stale
 * - retry: 1 attempt on failure
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds - reduces unnecessary refetches
      gcTime: 5 * 60 * 1000, // 5 minutes - keep unused data in cache
      refetchOnWindowFocus: 'always',
      retry: 1,
      refetchOnMount: true,
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

  // Templates domain
  templates: {
    all: ['templates'] as const,
    lists: () => [...queryKeys.templates.all, 'list'] as const,
  },
};
