import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-client";
import type { WorkspaceDirectoryEntry } from "@/types/desktop";

interface UseWorkspaceFilesOptions {
  rootPath: string | undefined;
  relativePath?: string;
  enabled?: boolean;
}

/**
 * TanStack Query hook that fetches workspace directory entries via Electron IPC.
 * Returns cached entries that can be fed into `useFileMention` or used directly.
 */
export function useWorkspaceFiles({
  rootPath,
  relativePath = "",
  enabled = true,
}: UseWorkspaceFilesOptions) {
  return useQuery<WorkspaceDirectoryEntry[]>({
    queryKey: queryKeys.workspaceFiles.list(rootPath ?? "", relativePath),
    queryFn: async () => {
      if (!rootPath || !window.api?.listDirectory) return [];
      const response = await window.api.listDirectory({
        rootPath,
        relativePath,
      });
      if (!response.ok || !response.entries) return [];
      return response.entries;
    },
    enabled: enabled && !!rootPath && typeof window !== "undefined" && !!window.api?.listDirectory,
    staleTime: 5 * 60 * 1000, // 5 minutes — directory contents change infrequently
    gcTime: 15 * 60 * 1000,
  });
}
