import { randomUUID } from 'node:crypto';

import { getSharedClient, queryOne, query } from '../db/shared-client.js';

import type {
  CreateProjectChecklistItemInput,
  SaveGeneratedProjectChecklistInput,
  UpdateProjectChecklistItemInput,
} from './project-checklists.repository.js';
import type {
  ChecklistItemStatus,
  ChecklistStats,
  ProjectChecklist,
  ProjectChecklistDetail,
  ProjectChecklistItem,
  ProjectChecklistSection,
} from '@workspace/shared';

interface TeamProjectTitleRow {
  title: string;
}

interface PgChecklistRow {
  id: string;
  team_id: string;
  project_id: string;
  template_id: string;
  template_version_id: string;
  title: string;
  created_by_email: string | null;
  updated_by_email: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface PgSectionRow {
  id: string;
  checklist_id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

interface PgItemRow {
  id: string;
  checklist_id: string;
  section_id: string;
  group_title: string | null;
  title: string;
  description: string | null;
  planned_date: Date | string | null;
  planned_time: string | null;
  location: string | null;
  pic: string | null;
  status: ChecklistItemStatus;
  owner: string | null;
  notes: string | null;
  evidence_url: string | null;
  completed_by_email: string | null;
  completed_at: Date | string | null;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
}

const toIso = (value: Date | string): string => {
  return value instanceof Date ? value.toISOString() : value;
};

const optionalIso = (value: Date | string | null): string | undefined => {
  if (!value) return undefined;
  return toIso(value);
};

const emptyStats = (): ChecklistStats => ({
  total: 0,
  completed: 0,
  inProgress: 0,
  blocked: 0,
  notApplicable: 0,
});

const calculateStats = (items: ProjectChecklistItem[]): ChecklistStats => {
  const stats = emptyStats();
  stats.total = items.length;

  for (const item of items) {
    if (item.status === 'completed') stats.completed += 1;
    if (item.status === 'in_progress') stats.inProgress += 1;
    if (item.status === 'blocked') stats.blocked += 1;
    if (item.status === 'not_applicable') stats.notApplicable += 1;
  }

  return stats;
};

const mapSectionRow = (row: PgSectionRow): ProjectChecklistSection => ({
  id: row.id,
  checklistId: row.checklist_id,
  title: row.title,
  description: row.description ?? undefined,
  sortOrder: row.sort_order,
});

const mapItemRow = (row: PgItemRow): ProjectChecklistItem => ({
  id: row.id,
  checklistId: row.checklist_id,
  sectionId: row.section_id,
  groupTitle: row.group_title ?? undefined,
  title: row.title,
  description: row.description ?? undefined,
  plannedDate: optionalIso(row.planned_date),
  plannedTime: row.planned_time ?? undefined,
  location: row.location ?? undefined,
  pic: row.pic ?? undefined,
  status: row.status,
  owner: row.owner ?? undefined,
  notes: row.notes ?? undefined,
  evidenceUrl: row.evidence_url ?? undefined,
  completedByEmail: row.completed_by_email ?? undefined,
  completedAt: optionalIso(row.completed_at),
  sortOrder: row.sort_order,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});

const mapChecklistRow = (row: PgChecklistRow, stats: ChecklistStats): ProjectChecklist => ({
  id: row.id,
  projectId: row.project_id,
  teamId: row.team_id,
  templateId: row.template_id,
  templateVersionId: row.template_version_id,
  title: row.title,
  stats,
  createdByEmail: row.created_by_email ?? undefined,
  updatedByEmail: row.updated_by_email ?? undefined,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});

const loadDetail = async (row: PgChecklistRow): Promise<ProjectChecklistDetail> => {
  const [sections, items] = await Promise.all([
    query<PgSectionRow>(
      `SELECT id, checklist_id, title, description, sort_order
       FROM project_checklist_sections
       WHERE checklist_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [row.id],
    ),
    query<PgItemRow>(
            `SELECT id, checklist_id, section_id, group_title, title, description,
              planned_date, planned_time, location, pic, status, owner, notes,
              evidence_url, completed_by_email, completed_at, sort_order, created_at, updated_at
       FROM project_checklist_items
       WHERE checklist_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [row.id],
    ),
  ]);

  const mappedItems = items.map(mapItemRow);

  return {
    ...mapChecklistRow(row, calculateStats(mappedItems)),
    sections: sections.map(mapSectionRow),
    items: mappedItems,
  };
};

export const projectChecklistsPgRepository = {
  async getProjectTitle(teamId: string, projectId: string): Promise<string | null> {
    const row = await queryOne<TeamProjectTitleRow>(
      'SELECT title FROM team_projects WHERE id = $1 AND team_id = $2',
      [projectId, teamId],
    );
    return row?.title ?? null;
  },

  async getByProjectId(teamId: string, projectId: string): Promise<ProjectChecklistDetail | null> {
    const row = await queryOne<PgChecklistRow>(
      `SELECT id, team_id, project_id, template_id, template_version_id, title,
              created_by_email, updated_by_email, created_at, updated_at
       FROM project_checklists
       WHERE team_id = $1 AND project_id = $2`,
      [teamId, projectId],
    );

    return row ? loadDetail(row) : null;
  },

  async saveGenerated(teamId: string, input: SaveGeneratedProjectChecklistInput): Promise<ProjectChecklistDetail> {
    const client = await getSharedClient();
    let checklistId = '';

    try {
      await client.query('BEGIN');

      const existing = await client.query<{ id: string }>(
        'SELECT id FROM project_checklists WHERE team_id = $1 AND project_id = $2',
        [teamId, input.projectId],
      );

      if (existing.rows[0]) {
        if (!input.overwrite) {
          checklistId = existing.rows[0].id;
        } else {
          await client.query('DELETE FROM project_checklists WHERE id = $1', [existing.rows[0].id]);
        }
      }

      if (!checklistId) {
        checklistId = randomUUID();
        await client.query(
          `INSERT INTO project_checklists (
             id, team_id, project_id, template_id, template_version_id, title, created_by_email, updated_by_email
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
          [
            checklistId,
            teamId,
            input.projectId,
            input.templateId,
            input.templateVersionId,
            input.title,
            input.createdByEmail ?? null,
          ],
        );

        let itemSortOrder = 0;
        for (const [sectionIndex, section] of input.sections.entries()) {
          const sectionId = randomUUID();
          await client.query(
            `INSERT INTO project_checklist_sections (id, checklist_id, title, description, sort_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [sectionId, checklistId, section.title, section.description ?? null, sectionIndex],
          );

          for (const item of section.items) {
            await client.query(
              `INSERT INTO project_checklist_items (
                 id, checklist_id, section_id, group_title, title, description,
                 planned_date, planned_time, location, pic, status, sort_order
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [
                randomUUID(),
                checklistId,
                sectionId,
                item.groupTitle ?? null,
                item.title,
                item.description ?? null,
                item.plannedDate ?? null,
                item.plannedTime ?? null,
                item.location ?? null,
                item.pic ?? null,
                item.status ?? 'pending',
                itemSortOrder,
              ],
            );
            itemSortOrder += 1;
          }
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const row = await queryOne<PgChecklistRow>(
      `SELECT id, team_id, project_id, template_id, template_version_id, title,
              created_by_email, updated_by_email, created_at, updated_at
       FROM project_checklists
       WHERE id = $1`,
      [checklistId],
    );

    if (!row) throw new Error('Generated checklist was not found after save');
    return loadDetail(row);
  },

  async createItem(teamId: string, projectId: string, input: CreateProjectChecklistItemInput): Promise<ProjectChecklistDetail | null> {
    const target = await queryOne<{ checklist_id: string; section_id: string }>(
      `SELECT c.id AS checklist_id, s.id AS section_id
       FROM project_checklists c
       JOIN project_checklist_sections s ON s.checklist_id = c.id
       WHERE c.team_id = $1 AND c.project_id = $2 AND s.id = $3`,
      [teamId, projectId, input.sectionId],
    );

    if (!target) return null;

    const maxSortRow = await queryOne<{ sort_order: string }>(
      'SELECT COALESCE(MAX(sort_order), -1)::text AS sort_order FROM project_checklist_items WHERE checklist_id = $1',
      [target.checklist_id],
    );
    const sortOrder = Number.parseInt(maxSortRow?.sort_order ?? '-1', 10) + 1;

    await query(
      `INSERT INTO project_checklist_items (
         id, checklist_id, section_id, group_title, title, description,
         planned_date, planned_time, location, pic, status, sort_order
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        randomUUID(),
        target.checklist_id,
        target.section_id,
        input.groupTitle ?? null,
        input.title ?? '',
        input.description ?? null,
        input.plannedDate ?? null,
        input.plannedTime ?? null,
        input.location ?? null,
        input.pic ?? null,
        input.status ?? 'pending',
        sortOrder,
      ],
    );

    await query(
      'UPDATE project_checklists SET updated_by_email = COALESCE($1, updated_by_email) WHERE id = $2',
      [input.createdByEmail ?? null, target.checklist_id],
    );

    return this.getByProjectId(teamId, projectId);
  },

  async updateItem(teamId: string, projectId: string, itemId: string, input: UpdateProjectChecklistItemInput): Promise<ProjectChecklistDetail | null> {
    const existing = await queryOne<{ id: string; checklist_id: string }>(
      `SELECT i.id, c.id AS checklist_id
       FROM project_checklist_items i
       JOIN project_checklists c ON c.id = i.checklist_id
       WHERE c.team_id = $1 AND c.project_id = $2 AND i.id = $3`,
      [teamId, projectId, itemId],
    );

    if (!existing) return null;

    const assignments: string[] = [];
    const values: unknown[] = [];

    const addAssignment = (column: string, value: unknown) => {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    };

    if (input.groupTitle !== undefined) addAssignment('group_title', input.groupTitle);
    if (input.title !== undefined) addAssignment('title', input.title);
    if (input.description !== undefined) addAssignment('description', input.description);
    if (input.plannedDate !== undefined) addAssignment('planned_date', input.plannedDate);
    if (input.plannedTime !== undefined) addAssignment('planned_time', input.plannedTime);
    if (input.location !== undefined) addAssignment('location', input.location);
    if (input.pic !== undefined) addAssignment('pic', input.pic);
    if (input.owner !== undefined) addAssignment('owner', input.owner);
    if (input.notes !== undefined) addAssignment('notes', input.notes);
    if (input.evidenceUrl !== undefined) addAssignment('evidence_url', input.evidenceUrl);
    if (input.status !== undefined) {
      addAssignment('status', input.status);
      addAssignment('completed_by_email', input.status === 'completed' ? input.updatedByEmail ?? null : null);
      addAssignment('completed_at', input.status === 'completed' ? new Date() : null);
    }

    if (assignments.length > 0) {
      values.push(itemId);
      await query(`UPDATE project_checklist_items SET ${assignments.join(', ')} WHERE id = $${values.length}`, values);
      await query(
        'UPDATE project_checklists SET updated_by_email = COALESCE($1, updated_by_email) WHERE id = $2',
        [input.updatedByEmail ?? null, existing.checklist_id],
      );
    }

    return this.getByProjectId(teamId, projectId);
  },

  async deleteItem(teamId: string, projectId: string, itemId: string, updatedByEmail?: string): Promise<ProjectChecklistDetail | null> {
    const existing = await queryOne<{ id: string; checklist_id: string }>(
      `SELECT i.id, c.id AS checklist_id
       FROM project_checklist_items i
       JOIN project_checklists c ON c.id = i.checklist_id
       WHERE c.team_id = $1 AND c.project_id = $2 AND i.id = $3`,
      [teamId, projectId, itemId],
    );

    if (!existing) return null;

    await query('DELETE FROM project_checklist_items WHERE id = $1', [itemId]);
    await query(
      'UPDATE project_checklists SET updated_by_email = COALESCE($1, updated_by_email) WHERE id = $2',
      [updatedByEmail ?? null, existing.checklist_id],
    );

    return this.getByProjectId(teamId, projectId);
  },
};