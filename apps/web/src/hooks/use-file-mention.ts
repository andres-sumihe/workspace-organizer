import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { MentionSuggestionItem } from "@/components/ui/mention-suggestion-list";
import { usePersonalProjectsList } from "@/features/journal/hooks/use-personal-projects";
import { queryKeys } from "@/lib/query-client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DEPTH = 3;
const MAX_ITEMS_PER_PROJECT = 300;

/** Directories to skip during recursive walk */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".git-rewrite",
  ".svn",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "__pycache__",
  ".cache",
  ".tmp",
  "coverage",
  ".node-local",
  ".vscode",
  ".idea",
  ".DS_Store",
]);

// ---------------------------------------------------------------------------
// Recursive directory walker
// ---------------------------------------------------------------------------

async function walkProject(
  rootPath: string,
  projectId: string,
  projectName: string,
): Promise<MentionSuggestionItem[]> {
  const results: MentionSuggestionItem[] = [];

  async function walk(relativePath: string, depth: number) {
    if (depth > MAX_DEPTH || results.length >= MAX_ITEMS_PER_PROJECT) return;

    try {
      const response = await window.api!.listDirectory({
        rootPath,
        relativePath,
      });
      if (!response.ok || !response.entries) return;

      const dirs: string[] = [];

      for (const entry of response.entries) {
        if (results.length >= MAX_ITEMS_PER_PROJECT) break;

        results.push({
          id: `${projectId}:${entry.path}`,
          label: entry.name,
          type: entry.type === "directory" ? "folder" : "file",
          path: entry.path,
          projectId,
          projectName,
        });

        if (
          entry.type === "directory" &&
          !SKIP_DIRS.has(entry.name.toLowerCase())
        ) {
          dirs.push(entry.path);
        }
      }

      // Recurse into sub-directories
      for (const dir of dirs) {
        if (results.length >= MAX_ITEMS_PER_PROJECT) break;
        await walk(dir, depth + 1);
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  await walk("", 0);
  return results;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook that searches files/folders across ALL registered PersonalProject directories.
 *
 * Flow:
 *  1. Fetches all projects that have a `folderPath` via TanStack Query
 *  2. Recursively lists directory entries for each project (cached, depth ≤ 3)
 *  3. On every keystroke, filters the combined entries client-side
 *  4. Each result includes `projectId` / `projectName` for navigation
 */
export function useProjectFileMention(limit = 20) {
  const { data: projectsData } = usePersonalProjectsList();

  const projectsWithPaths = useMemo(
    () => (projectsData?.items ?? []).filter((p) => p.folderPath),
    [projectsData],
  );

  const projectIds = useMemo(
    () => projectsWithPaths.map((p) => p.id).sort(),
    [projectsWithPaths],
  );

  // Fetch directory entries for ALL projects (cached)
  const { data: allEntries = [] } = useQuery<MentionSuggestionItem[]>({
    queryKey: [...queryKeys.workspaceFiles.all, "projects-recursive", projectIds],
    queryFn: async () => {
      if (!window.api?.listDirectory) return [];

      const perProject = await Promise.all(
        projectsWithPaths.map((project) =>
          walkProject(project.folderPath!, project.id, project.title),
        ),
      );

      return perProject.flat();
    },
    enabled:
      projectsWithPaths.length > 0 &&
      typeof window !== "undefined" &&
      !!window.api?.listDirectory,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Resolver — filters cached entries per keystroke
  const resolve = useCallback(
    async (query: string): Promise<MentionSuggestionItem[]> => {
      const q = query.toLowerCase();
      if (!q) return allEntries.slice(0, limit);

      return allEntries
        .filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            (item.path ?? "").toLowerCase().includes(q) ||
            (item.projectName ?? "").toLowerCase().includes(q),
        )
        .slice(0, limit);
    },
    [allEntries, limit],
  );

  return resolve;
}
