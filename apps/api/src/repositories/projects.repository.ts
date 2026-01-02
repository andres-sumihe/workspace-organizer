import { getDb } from '../db/client.js';

import type { WorkspaceProject } from '@workspace/shared';

interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  relative_path: string;
  created_at: string;
  updated_at: string;
}

const isProjectRow = (value: unknown): value is ProjectRow => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.workspace_id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.relative_path === 'string' &&
    typeof candidate.created_at === 'string' &&
    typeof candidate.updated_at === 'string'
  );
};

const mapRowToProject = (row: ProjectRow): WorkspaceProject => ({
  id: row.id,
  workspaceId: row.workspace_id,
  name: row.name,
  relativePath: row.relative_path,
  description: row.description ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const listProjectsByWorkspace = async (workspaceId: string): Promise<WorkspaceProject[]> => {
  const db = await getDb();
  const rowsRaw = db.prepare('SELECT * FROM projects WHERE workspace_id = ? ORDER BY name').all(workspaceId);

  const projects: WorkspaceProject[] = [];
  if (Array.isArray(rowsRaw)) {
    for (const row of rowsRaw) {
      if (isProjectRow(row)) {
        projects.push(mapRowToProject(row));
      }
    }
  }

  return projects;
};

export interface CreateProjectInput {
  id: string;
  workspaceId: string;
  name: string;
  relativePath: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export const createProject = async (input: CreateProjectInput): Promise<WorkspaceProject> => {
  const db = await getDb();
  db.prepare(
    `INSERT INTO projects (id, name, description, workspace_id, relative_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.id,
    input.name,
    input.description ?? null,
    input.workspaceId,
    input.relativePath,
    input.createdAt,
    input.updatedAt
  );

  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(input.id);
  if (!isProjectRow(row)) {
    throw new Error('Failed to load created project');
  }

  return mapRowToProject(row);
};

export const findProjectByWorkspaceAndPath = async (workspaceId: string, relativePath: string) => {
  const db = await getDb();
  const row = db.prepare('SELECT * FROM projects WHERE workspace_id = ? AND relative_path = ?').get(
    workspaceId,
    relativePath
  );

  if (!isProjectRow(row)) {
    return null;
  }

  return mapRowToProject(row);
};
