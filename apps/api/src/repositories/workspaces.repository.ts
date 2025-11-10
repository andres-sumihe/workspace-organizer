import { getDb } from '../db/client.js';

import type { WorkspaceDetail, WorkspaceSummary, WorkspaceStatus } from '@workspace/shared';

interface WorkspaceSummaryRow {
  id: string;
  name: string;
  status: WorkspaceStatus;
  project_count: number;
  template_count: number;
  last_indexed_at: string;
  root_path: string;
  description: string | null;
  settings_json: string;
  statistics_json: string;
  created_at: string;
  updated_at: string;
}

const fallbackStatistics = {
  totalFolders: 0,
  totalFiles: 0,
  storageBytes: 0,
  lastScanAt: new Date(0).toISOString()
};

const fallbackSettings = {
  enforceNamingRules: false,
  namingRules: []
};

const isWorkspaceStatus = (value: unknown): value is WorkspaceStatus => {
  return value === 'healthy' || value === 'degraded' || value === 'offline';
};

const isWorkspaceSummaryRow = (value: unknown): value is WorkspaceSummaryRow => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    isWorkspaceStatus(candidate.status) &&
    typeof candidate.project_count === 'number' &&
    typeof candidate.template_count === 'number' &&
    typeof candidate.last_indexed_at === 'string' &&
    typeof candidate.root_path === 'string' &&
    typeof candidate.settings_json === 'string' &&
    typeof candidate.statistics_json === 'string' &&
    typeof candidate.created_at === 'string' &&
    typeof candidate.updated_at === 'string'
  );
};

const mapRowToSummary = (row: WorkspaceSummaryRow): WorkspaceSummary => {
  const summary = {
    id: row.id,
    name: row.name,
    status: row.status,
    projectCount: row.project_count,
    templateCount: row.template_count,
    lastIndexedAt: row.last_indexed_at
  } satisfies WorkspaceSummary;

  return summary;
};

const mapRowToDetail = (row: WorkspaceSummaryRow): WorkspaceDetail => {
  const settings = safeParseJSON(row.settings_json, fallbackSettings);
  const statistics = safeParseJSON(row.statistics_json, fallbackStatistics);

  return {
    ...mapRowToSummary(row),
    rootPath: row.root_path,
    description: row.description ?? undefined,
    settings,
    statistics,
    recentActivity: [],
    templates: []
  };
};

const safeParseJSON = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export interface ListWorkspacesParams {
  limit: number;
  offset: number;
}

export const listWorkspaces = async ({ limit, offset }: ListWorkspacesParams): Promise<WorkspaceSummary[]> => {
  const db = await getDb();
  const rowsRaw: unknown = await db.all('SELECT * FROM workspaces ORDER BY name LIMIT ? OFFSET ?', [
    limit,
    offset
  ]);

  const summaries: WorkspaceSummary[] = [];

  if (Array.isArray(rowsRaw)) {
    for (const row of rowsRaw) {
      if (isWorkspaceSummaryRow(row)) {
        summaries.push(mapRowToSummary(row));
      }
    }
  }

  return summaries;
};

export const countWorkspaces = async (): Promise<number> => {
  const db = await getDb();
  const result: unknown = await db.get('SELECT COUNT(1) as count FROM workspaces');

  if (result && typeof result === 'object' && typeof (result as { count?: unknown }).count === 'number') {
    return (result as { count: number }).count;
  }

  return 0;
};

export const findWorkspaceById = async (id: string): Promise<WorkspaceDetail | null> => {
  const db = await getDb();
  const row: unknown = await db.get('SELECT * FROM workspaces WHERE id = ?', [id]);

  if (!isWorkspaceSummaryRow(row)) {
    return null;
  }

  return mapRowToDetail(row);
};

export interface CreateWorkspaceInput {
  name: string;
  rootPath: string;
  description?: string;
  settings?: unknown;
  statistics?: unknown;
}

export const createWorkspace = async (input: CreateWorkspaceInput & { id: string; status?: string; createdAt: string; updatedAt: string; lastIndexedAt?: string; }): Promise<WorkspaceDetail> => {
  const db = await getDb();

  const {
    id,
    name,
    rootPath,
    description,
    status = 'offline',
    settings = {},
    statistics = {},
    createdAt,
    updatedAt,
    lastIndexedAt = createdAt
  } = input;

  await db.run(
    `INSERT INTO workspaces (
      id, name, application, status, project_count, template_count, last_indexed_at,
      root_path, description, settings_json, statistics_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      '', /* compatibility: existing DBs may still require non-null application */
      status,
      lastIndexedAt,
      rootPath,
      description ?? null,
      JSON.stringify(settings),
      JSON.stringify(statistics),
      createdAt,
      updatedAt
    ]
  );

  const created = await findWorkspaceById(id);

  if (!created) {
    throw new Error('Failed to create workspace');
  }

  return created;
};
