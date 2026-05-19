import { randomUUID } from 'node:crypto';

import { getDb } from '../db/client.js';

import type {
  ChecklistTemplateDetail,
  ChecklistTemplateMappingStatus,
  ChecklistTemplateSummary,
  ChecklistTemplateVersionSummary,
} from '@workspace/shared';

export interface SaveChecklistTemplateInput {
  templateId?: string;
  name: string;
  description?: string;
  versionLabel: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  xlsxBuffer: Buffer;
  mappingJson?: Record<string, unknown>;
  mappingStatus: ChecklistTemplateMappingStatus;
  uploadedByEmail?: string;
  activate: boolean;
}

export interface ChecklistTemplateFileRecord {
  templateId: string;
  versionId: string;
  originalFilename: string;
  mimeType: string;
  xlsxBuffer: Buffer;
}

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  is_active: number;
  created_by_email: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
  active_version_id: string | null;
  active_version_label: string | null;
  active_original_filename: string | null;
  active_mime_type: string | null;
  active_size_bytes: number | null;
  active_checksum_sha256: string | null;
  active_mapping_json: string | null;
  active_mapping_status: ChecklistTemplateMappingStatus | null;
  active_uploaded_by_email: string | null;
  active_version_created_at: string | null;
}

interface VersionRow {
  id: string;
  template_id: string;
  version_label: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  mapping_json: string | null;
  mapping_status: ChecklistTemplateMappingStatus;
  is_active: number;
  uploaded_by_email: string | null;
  created_at: string;
}

const hasMapping = (mappingJson: string | null | undefined): boolean => {
  return typeof mappingJson === 'string' && mappingJson.trim().length > 0;
};

const mapActiveVersion = (row: TemplateRow): ChecklistTemplateVersionSummary | undefined => {
  if (!row.active_version_id) return undefined;

  return {
    id: row.active_version_id,
    templateId: row.id,
    versionLabel: row.active_version_label ?? '',
    originalFilename: row.active_original_filename ?? '',
    mimeType: row.active_mime_type ?? '',
    sizeBytes: row.active_size_bytes ?? 0,
    checksumSha256: row.active_checksum_sha256 ?? '',
    mappingStatus: row.active_mapping_status ?? 'pending',
    hasMapping: hasMapping(row.active_mapping_json),
    isActive: true,
    uploadedByEmail: row.active_uploaded_by_email ?? undefined,
    createdAt: row.active_version_created_at ?? row.created_at,
  };
};

const mapTemplateRow = (row: TemplateRow): ChecklistTemplateSummary => ({
  id: row.id,
  name: row.name,
  description: row.description ?? undefined,
  storageScope: 'local',
  isActive: row.is_active === 1,
  activeVersion: mapActiveVersion(row),
  createdByEmail: row.created_by_email ?? undefined,
  updatedByEmail: row.updated_by_email ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapVersionRow = (row: VersionRow): ChecklistTemplateVersionSummary => ({
  id: row.id,
  templateId: row.template_id,
  versionLabel: row.version_label,
  originalFilename: row.original_filename,
  mimeType: row.mime_type,
  sizeBytes: row.size_bytes,
  checksumSha256: row.checksum_sha256,
  mappingStatus: row.mapping_status,
  hasMapping: hasMapping(row.mapping_json),
  isActive: row.is_active === 1,
  uploadedByEmail: row.uploaded_by_email ?? undefined,
  createdAt: row.created_at,
});

const templateSelect = `
  SELECT
    t.*,
    v.id AS active_version_id,
    v.version_label AS active_version_label,
    v.original_filename AS active_original_filename,
    v.mime_type AS active_mime_type,
    v.size_bytes AS active_size_bytes,
    v.checksum_sha256 AS active_checksum_sha256,
    v.mapping_json AS active_mapping_json,
    v.mapping_status AS active_mapping_status,
    v.uploaded_by_email AS active_uploaded_by_email,
    v.created_at AS active_version_created_at
  FROM checklist_templates t
  LEFT JOIN checklist_template_versions v ON v.template_id = t.id AND v.is_active = 1
`;

export const checklistTemplatesRepository = {
  async list(): Promise<ChecklistTemplateSummary[]> {
    const db = await getDb();
    const rows = db.prepare(`${templateSelect} ORDER BY t.is_active DESC, t.updated_at DESC`).all() as TemplateRow[];
    return rows.map(mapTemplateRow);
  },

  async getById(templateId: string): Promise<ChecklistTemplateDetail | null> {
    const db = await getDb();
    const row = db.prepare(`${templateSelect} WHERE t.id = ?`).get(templateId) as TemplateRow | undefined;
    if (!row) return null;

    const versions = db.prepare(`
      SELECT * FROM checklist_template_versions
      WHERE template_id = ?
      ORDER BY is_active DESC, created_at DESC
    `).all(templateId) as VersionRow[];

    return {
      ...mapTemplateRow(row),
      versions: versions.map(mapVersionRow),
    };
  },

  async saveVersion(input: SaveChecklistTemplateInput): Promise<ChecklistTemplateDetail> {
    const db = await getDb();
    const templateId = input.templateId ?? randomUUID();
    const versionId = randomUUID();
    const mappingJson = input.mappingJson ? JSON.stringify(input.mappingJson) : null;
    const isNewTemplate = !input.templateId;

    const save = db.transaction(() => {
      if (input.activate) {
        db.prepare('UPDATE checklist_templates SET is_active = 0, updated_by_email = ?').run(input.uploadedByEmail ?? null);
      }

      if (isNewTemplate) {
        db.prepare(`
          INSERT INTO checklist_templates (id, name, description, is_active, created_by_email, updated_by_email)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          templateId,
          input.name,
          input.description ?? null,
          input.activate ? 1 : 0,
          input.uploadedByEmail ?? null,
          input.uploadedByEmail ?? null,
        );
      } else {
        db.prepare(`
          UPDATE checklist_templates
          SET name = ?, description = ?, is_active = CASE WHEN ? = 1 THEN 1 ELSE is_active END, updated_by_email = ?
          WHERE id = ?
        `).run(input.name, input.description ?? null, input.activate ? 1 : 0, input.uploadedByEmail ?? null, templateId);
      }

      if (input.activate) {
        db.prepare('UPDATE checklist_template_versions SET is_active = 0 WHERE template_id = ?').run(templateId);
      }

      db.prepare(`
        INSERT INTO checklist_template_versions (
          id,
          template_id,
          version_label,
          original_filename,
          mime_type,
          size_bytes,
          checksum_sha256,
          xlsx_blob,
          mapping_json,
          mapping_status,
          is_active,
          uploaded_by_email
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        versionId,
        templateId,
        input.versionLabel,
        input.originalFilename,
        input.mimeType,
        input.sizeBytes,
        input.checksumSha256,
        input.xlsxBuffer,
        mappingJson,
        input.mappingStatus,
        input.activate ? 1 : 0,
        input.uploadedByEmail ?? null,
      );
    });

    save();

    const template = await this.getById(templateId);
    if (!template) {
      throw new Error('Checklist template was not saved');
    }
    return template;
  },

  async activateVersion(templateId: string, versionId: string, updatedByEmail?: string): Promise<ChecklistTemplateDetail | null> {
    const db = await getDb();
    const version = db.prepare(
      'SELECT id FROM checklist_template_versions WHERE id = ? AND template_id = ?',
    ).get(versionId, templateId) as { id: string } | undefined;
    if (!version) return null;

    const activate = db.transaction(() => {
      db.prepare('UPDATE checklist_templates SET is_active = 0, updated_by_email = ?').run(updatedByEmail ?? null);
      db.prepare('UPDATE checklist_templates SET is_active = 1, updated_by_email = ? WHERE id = ?').run(updatedByEmail ?? null, templateId);
      db.prepare('UPDATE checklist_template_versions SET is_active = 0 WHERE template_id = ?').run(templateId);
      db.prepare('UPDATE checklist_template_versions SET is_active = 1 WHERE id = ?').run(versionId);
    });

    activate();
    return this.getById(templateId);
  },

  async getVersionFile(templateId: string, versionId: string): Promise<ChecklistTemplateFileRecord | null> {
    const db = await getDb();
    const row = db.prepare(`
      SELECT template_id, id, original_filename, mime_type, xlsx_blob
      FROM checklist_template_versions
      WHERE template_id = ? AND id = ?
    `).get(templateId, versionId) as {
      template_id: string;
      id: string;
      original_filename: string;
      mime_type: string;
      xlsx_blob: Buffer;
    } | undefined;

    if (!row) return null;
    return {
      templateId: row.template_id,
      versionId: row.id,
      originalFilename: row.original_filename,
      mimeType: row.mime_type,
      xlsxBuffer: row.xlsx_blob,
    };
  },
};