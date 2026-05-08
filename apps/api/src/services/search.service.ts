import { notesService } from './notes.service.js';
import { personalProjectsService } from './personal-projects.service.js';
import { query as sharedQuery, isSharedDbConnected } from '../db/shared-client.js';
import { listScripts } from '../repositories/scripts.repository.js';
import { workLogsRepository } from '../repositories/work-logs.repository.js';
import { searchWorkspaces } from '../repositories/workspaces.repository.js';

import type {
  AuthenticatedUser,
  GlobalSearchResponse,
  SearchResultItem,
} from '@workspace/shared';

interface TeamProjectSearchRow {
  id: string;
  team_id: string;
  team_name: string;
  title: string;
  description: string | null;
  updated_at: string;
}

const MIN_LIMIT = 1;
const MAX_LIMIT = 10;

const clampLimit = (limit: number) => Math.min(Math.max(limit, MIN_LIMIT), MAX_LIMIT);

const compactText = (value: string) => value.replace(/\s+/g, ' ').trim();

const collectJsonText = (value: unknown): string[] => {
  if (!value || typeof value !== 'object') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectJsonText(item));
  }

  const candidate = value as Record<string, unknown>;
  const ownText = typeof candidate.text === 'string' ? [candidate.text] : [];
  return [
    ...ownText,
    ...Object.values(candidate).flatMap((item) => collectJsonText(item)),
  ];
};

const extractPlainText = (value: string | undefined): string => {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const jsonText = collectJsonText(JSON.parse(trimmed)).join(' ');
      if (jsonText.trim()) {
        return compactText(jsonText);
      }
    } catch {
      // Fall through to lightweight plain-text cleanup.
    }
  }

  return compactText(trimmed.replace(/<[^>]*>/g, ' '));
};

const makePreview = (value: string | undefined, query: string, maxLength = 120): string | undefined => {
  const text = extractPlainText(value);
  if (!text) {
    return undefined;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);
  const start = matchIndex > 30 ? matchIndex - 30 : 0;
  const slice = text.slice(start, start + maxLength);

  return `${start > 0 ? '...' : ''}${slice}${start + maxLength < text.length ? '...' : ''}`;
};

const searchScripts = async (query: string, limit: number): Promise<SearchResultItem[]> => {
  if (!isSharedDbConnected()) {
    return [];
  }

  const scripts = await listScripts({ limit, offset: 0, searchQuery: query });
  return scripts.map((script) => ({
    id: script.id,
    type: 'script',
    title: script.name,
    subtitle: script.type,
    preview: makePreview(script.description, query),
    url: `/scripts/${script.id}`,
    updatedAt: script.updatedAt,
  }));
};

const searchTeamProjects = async (
  query: string,
  limit: number,
  user?: AuthenticatedUser,
): Promise<SearchResultItem[]> => {
  if (!isSharedDbConnected() || !user?.email) {
    return [];
  }

  const rows = await sharedQuery<TeamProjectSearchRow>(
    `SELECT p.id, p.team_id, t.name AS team_name, p.title, p.description, p.updated_at
     FROM team_projects p
     JOIN teams t ON t.id = p.team_id
     JOIN team_members tm ON tm.team_id = p.team_id
     WHERE tm.email = $1
       AND (
         p.title ILIKE $2
         OR p.description ILIKE $2
         OR p.business_proposal_id ILIKE $2
         OR p.change_id ILIKE $2
       )
     ORDER BY p.updated_at DESC
     LIMIT $3`,
    [user.email, `%${query}%`, limit],
  );

  return rows.map((project) => ({
    id: project.id,
    type: 'team-project',
    title: project.title,
    subtitle: project.team_name,
    preview: makePreview(project.description ?? undefined, query),
    url: `/team-projects/${project.id}?teamId=${encodeURIComponent(project.team_id)}`,
    updatedAt: project.updated_at,
  }));
};

export const searchService = {
  async search(query: string, user?: AuthenticatedUser, limitPerDomain = 5): Promise<GlobalSearchResponse> {
    const trimmedQuery = query.trim();
    const limit = clampLimit(limitPerDomain);

    if (!trimmedQuery) {
      return {
        query: trimmedQuery,
        items: [],
        meta: { total: 0, limitPerDomain: limit },
      };
    }

    const searches: Array<Promise<SearchResultItem[]>> = [
      searchWorkspaces(trimmedQuery, limit).then((workspaces) =>
        workspaces.map((workspace) => ({
          id: workspace.id,
          type: 'workspace',
          title: workspace.name,
          subtitle: workspace.rootPath,
          url: `/workspaces/${workspace.id}`,
          updatedAt: workspace.lastIndexedAt,
        })),
      ),
      personalProjectsService.search(trimmedQuery, limit).then((projects) =>
        projects.map((project) => ({
          id: project.id,
          type: 'personal-project',
          title: project.title,
          subtitle: project.status,
          preview: makePreview(project.description ?? project.notes, trimmedQuery),
          url: `/projects/${project.id}`,
          updatedAt: project.updatedAt,
        })),
      ),
      notesService.search(trimmedQuery, limit).then((notes) =>
        notes.map((note) => ({
          id: note.id,
          type: 'note',
          title: note.title,
          subtitle: note.project?.title,
          preview: makePreview(note.content, trimmedQuery),
          url: `/notes?noteId=${encodeURIComponent(note.id)}`,
          updatedAt: note.updatedAt,
        })),
      ),
      workLogsRepository.search(trimmedQuery, limit).then((entries) =>
        entries.map((entry) => ({
          id: entry.id,
          type: 'journal',
          title: extractPlainText(entry.content) || 'Journal entry',
          subtitle: entry.date,
          preview: makePreview(entry.content, trimmedQuery),
          url: `/journal?date=${encodeURIComponent(entry.date)}`,
          updatedAt: entry.updatedAt,
        })),
      ),
      searchScripts(trimmedQuery, limit),
      searchTeamProjects(trimmedQuery, limit, user),
    ];

    const settled = await Promise.allSettled(searches);
    const items = settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

    return {
      query: trimmedQuery,
      items,
      meta: {
        total: items.length,
        limitPerDomain: limit,
      },
    };
  },
};