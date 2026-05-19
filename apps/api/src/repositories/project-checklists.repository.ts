import { randomUUID } from 'node:crypto';

import { getDb } from '../db/client.js';

import type {
  ChecklistItemStatus,
  ChecklistStats,
  ProjectChecklist,
  ProjectChecklistDetail,
  ProjectChecklistItem,
  ProjectChecklistSection,
} from '@workspace/shared';

export interface ChecklistItemDraft {
  groupTitle?: string;
  title: string;
  description?: string;
  plannedDate?: string;
  plannedTime?: string;
  location?: string;
  pic?: string;
  status?: ChecklistItemStatus;
}

export interface ChecklistSectionDraft {
  title: string;
  description?: string;
  items: ChecklistItemDraft[];
}

export interface SaveGeneratedProjectChecklistInput {
  projectId: string;
  templateId: string;
  templateVersionId: string;
  title: string;
  sections: ChecklistSectionDraft[];
  createdByEmail?: string;
  overwrite: boolean;
}

export interface UpdateProjectChecklistItemInput {
  groupTitle?: string | null;
  title?: string;
  description?: string | null;
  plannedDate?: string | null;
  plannedTime?: string | null;
  location?: string | null;
  pic?: string | null;
  status?: ChecklistItemStatus;
  owner?: string | null;
  notes?: string | null;
  evidenceUrl?: string | null;
  updatedByEmail?: string;
}

export interface CreateProjectChecklistItemInput {
  sectionId: string;
  groupTitle?: string | null;
  title?: string;
  description?: string | null;
  plannedDate?: string | null;
  plannedTime?: string | null;
  location?: string | null;
  pic?: string | null;
  status?: ChecklistItemStatus;
  createdByEmail?: string;
}

interface ProjectTitleRow {
  title: string;
}

interface ChecklistRow {
  id: string;
  project_id: string;
  template_id: string;
  template_version_id: string;
  title: string;
  created_by_email: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
}

interface SectionRow {
  id: string;
  checklist_id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

interface ItemRow {
  id: string;
  checklist_id: string;
  section_id: string;
  group_title: string | null;
  title: string;
  description: string | null;
  planned_date: string | null;
  planned_time: string | null;
  location: string | null;
  pic: string | null;
  status: ChecklistItemStatus;
  owner: string | null;
  notes: string | null;
  evidence_url: string | null;
  completed_by_email: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

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

const mapSectionRow = (row: SectionRow): ProjectChecklistSection => ({
  id: row.id,
  checklistId: row.checklist_id,
  title: row.title,
  description: row.description ?? undefined,
  sortOrder: row.sort_order,
});

const mapItemRow = (row: ItemRow): ProjectChecklistItem => ({
  id: row.id,
  checklistId: row.checklist_id,
  sectionId: row.section_id,
  groupTitle: row.group_title ?? undefined,
  title: row.title,
  description: row.description ?? undefined,
  plannedDate: row.planned_date ?? undefined,
  plannedTime: row.planned_time ?? undefined,
  location: row.location ?? undefined,
  pic: row.pic ?? undefined,
  status: row.status,
  owner: row.owner ?? undefined,
  notes: row.notes ?? undefined,
  evidenceUrl: row.evidence_url ?? undefined,
  completedByEmail: row.completed_by_email ?? undefined,
  completedAt: row.completed_at ?? undefined,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapChecklistRow = (row: ChecklistRow, stats: ChecklistStats): ProjectChecklist => ({
  id: row.id,
  projectId: row.project_id,
  templateId: row.template_id,
  templateVersionId: row.template_version_id,
  title: row.title,
  stats,
  createdByEmail: row.created_by_email ?? undefined,
  updatedByEmail: row.updated_by_email ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const loadDetail = async (row: ChecklistRow): Promise<ProjectChecklistDetail> => {
  const db = await getDb();
  const sections = db.prepare(`
    SELECT id, checklist_id, title, description, sort_order
    FROM project_checklist_sections
    WHERE checklist_id = ?
    ORDER BY sort_order ASC, created_at ASC
  `).all(row.id) as SectionRow[];

  const items = db.prepare(`
        SELECT id, checklist_id, section_id, group_title, title, description, planned_date,
          planned_time, location, pic, status, owner, notes, evidence_url,
          completed_by_email, completed_at, sort_order, created_at, updated_at
    FROM project_checklist_items
    WHERE checklist_id = ?
    ORDER BY sort_order ASC, created_at ASC
  `).all(row.id) as ItemRow[];

  const mappedItems = items.map(mapItemRow);

  return {
    ...mapChecklistRow(row, calculateStats(mappedItems)),
    sections: sections.map(mapSectionRow),
    items: mappedItems,
  };
};

export const projectChecklistsRepository = {
  async getProjectTitle(projectId: string): Promise<string | null> {
    const db = await getDb();
    const row = db.prepare('SELECT title FROM personal_projects WHERE id = ?').get(projectId) as ProjectTitleRow | undefined;
    return row?.title ?? null;
  },

  async getByProjectId(projectId: string): Promise<ProjectChecklistDetail | null> {
    const db = await getDb();
    const row = db.prepare(`
      SELECT id, project_id, template_id, template_version_id, title,
             created_by_email, updated_by_email, created_at, updated_at
      FROM project_checklists
      WHERE project_id = ?
    `).get(projectId) as ChecklistRow | undefined;

    return row ? loadDetail(row) : null;
  },

  async saveGenerated(input: SaveGeneratedProjectChecklistInput): Promise<ProjectChecklistDetail> {
    const db = await getDb();

    const save = db.transaction(() => {
      const existing = db.prepare('SELECT id FROM project_checklists WHERE project_id = ?').get(input.projectId) as { id: string } | undefined;
      if (existing) {
        if (!input.overwrite) return existing.id;
        db.prepare('DELETE FROM project_checklists WHERE id = ?').run(existing.id);
      }

      const checklistId = randomUUID();
      db.prepare(`
        INSERT INTO project_checklists (
          id, project_id, template_id, template_version_id, title, created_by_email, updated_by_email
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        checklistId,
        input.projectId,
        input.templateId,
        input.templateVersionId,
        input.title,
        input.createdByEmail ?? null,
        input.createdByEmail ?? null,
      );

      let itemSortOrder = 0;
      input.sections.forEach((section, sectionIndex) => {
        const sectionId = randomUUID();
        db.prepare(`
          INSERT INTO project_checklist_sections (id, checklist_id, title, description, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `).run(sectionId, checklistId, section.title, section.description ?? null, sectionIndex);

        for (const item of section.items) {
          db.prepare(`
            INSERT INTO project_checklist_items (
              id, checklist_id, section_id, group_title, title, description,
              planned_date, planned_time, location, pic, status, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
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
          );
          itemSortOrder += 1;
        }
      });

      return checklistId;
    });

    const checklistId = save();
    const row = db.prepare(`
      SELECT id, project_id, template_id, template_version_id, title,
             created_by_email, updated_by_email, created_at, updated_at
      FROM project_checklists
      WHERE id = ?
    `).get(checklistId) as ChecklistRow;

    return loadDetail(row);
  },

  async createItem(projectId: string, input: CreateProjectChecklistItemInput): Promise<ProjectChecklistDetail | null> {
    const db = await getDb();
    const target = db.prepare(`
      SELECT c.id AS checklist_id, s.id AS section_id
      FROM project_checklists c
      JOIN project_checklist_sections s ON s.checklist_id = c.id
      WHERE c.project_id = ? AND s.id = ?
    `).get(projectId, input.sectionId) as { checklist_id: string; section_id: string } | undefined;

    if (!target) return null;

    const maxSortRow = db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) AS sort_order FROM project_checklist_items WHERE checklist_id = ?'
    ).get(target.checklist_id) as { sort_order: number };

    db.prepare(`
      INSERT INTO project_checklist_items (
        id, checklist_id, section_id, group_title, title, description,
        planned_date, planned_time, location, pic, status, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
      maxSortRow.sort_order + 1,
    );

    db.prepare('UPDATE project_checklists SET updated_by_email = COALESCE(?, updated_by_email) WHERE id = ?').run(
      input.createdByEmail ?? null,
      target.checklist_id,
    );

    return this.getByProjectId(projectId);
  },

  async updateItem(projectId: string, itemId: string, input: UpdateProjectChecklistItemInput): Promise<ProjectChecklistDetail | null> {
    const db = await getDb();
    const existing = db.prepare(`
      SELECT i.id, c.id AS checklist_id
      FROM project_checklist_items i
      JOIN project_checklists c ON c.id = i.checklist_id
      WHERE c.project_id = ? AND i.id = ?
    `).get(projectId, itemId) as { id: string; checklist_id: string } | undefined;

    if (!existing) return null;

    const assignments: string[] = [];
    const values: unknown[] = [];

    const addAssignment = (column: string, value: unknown) => {
      assignments.push(`${column} = ?`);
      values.push(value);
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
      addAssignment('completed_at', input.status === 'completed' ? new Date().toISOString() : null);
    }

    if (assignments.length > 0) {
      db.prepare(`UPDATE project_checklist_items SET ${assignments.join(', ')} WHERE id = ?`).run(...values, itemId);
      db.prepare('UPDATE project_checklists SET updated_by_email = COALESCE(?, updated_by_email) WHERE id = ?').run(
        input.updatedByEmail ?? null,
        existing.checklist_id,
      );
    }

    return this.getByProjectId(projectId);
  },

  async deleteItem(projectId: string, itemId: string, updatedByEmail?: string): Promise<ProjectChecklistDetail | null> {
    const db = await getDb();
    const existing = db.prepare(`
      SELECT i.id, c.id AS checklist_id
      FROM project_checklist_items i
      JOIN project_checklists c ON c.id = i.checklist_id
      WHERE c.project_id = ? AND i.id = ?
    `).get(projectId, itemId) as { id: string; checklist_id: string } | undefined;

    if (!existing) return null;

    db.prepare('DELETE FROM project_checklist_items WHERE id = ?').run(itemId);
    db.prepare('UPDATE project_checklists SET updated_by_email = COALESCE(?, updated_by_email) WHERE id = ?').run(
      updatedByEmail ?? null,
      existing.checklist_id,
    );

    return this.getByProjectId(projectId);
  },
};