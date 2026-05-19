import { getSharedClient, query, queryOne } from '../db/shared-client.js';

import type { SaveChecklistTemplateInput, ChecklistTemplateFileRecord } from './checklist-templates.repository.js';
import type {
  ChecklistTemplateDetail,
  ChecklistTemplateMappingStatus,
  ChecklistTemplateSummary,
  ChecklistTemplateVersionSummary,
} from '@workspace/shared';

interface TemplateRow {
  id: string;
  team_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_by_email: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
  active_version_id: string | null;
  active_version_label: string | null;
  active_original_filename: string | null;
  active_mime_type: string | null;
  active_size_bytes: string | number | null;
  active_checksum_sha256: string | null;
  active_mapping_json: Record<string, unknown> | null;
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
  size_bytes: string | number;
  checksum_sha256: string;
  mapping_json: Record<string, unknown> | null;
  mapping_status: ChecklistTemplateMappingStatus;
  is_active: boolean;
  uploaded_by_email: string | null;
  created_at: string;
}

const toNumber = (value: string | number | null): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
};

const hasMapping = (mappingJson: Record<string, unknown> | null | undefined): boolean => {
  return Boolean(mappingJson && Object.keys(mappingJson).length > 0);
};

const mapActiveVersion = (row: TemplateRow): ChecklistTemplateVersionSummary | undefined => {
  if (!row.active_version_id) return undefined;

  return {
    id: row.active_version_id,
    templateId: row.id,
    versionLabel: row.active_version_label ?? '',
    originalFilename: row.active_original_filename ?? '',
    mimeType: row.active_mime_type ?? '',
    sizeBytes: toNumber(row.active_size_bytes),
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
  teamId: row.team_id,
  name: row.name,
  description: row.description ?? undefined,
  storageScope: 'shared',
  isActive: row.is_active,
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
  sizeBytes: toNumber(row.size_bytes),
  checksumSha256: row.checksum_sha256,
  mappingStatus: row.mapping_status,
  hasMapping: hasMapping(row.mapping_json),
  isActive: row.is_active,
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
  LEFT JOIN checklist_template_versions v ON v.template_id = t.id AND v.is_active = TRUE
`;

export const checklistTemplatesPgRepository = {
  async list(teamId: string): Promise<ChecklistTemplateSummary[]> {
    const rows = await query<TemplateRow>(
      `${templateSelect} WHERE t.team_id = $1 ORDER BY t.is_active DESC, t.updated_at DESC`,
      [teamId],
    );
    return rows.map(mapTemplateRow);
  },

  async getById(teamId: string, templateId: string): Promise<ChecklistTemplateDetail | null> {
    const row = await queryOne<TemplateRow>(`${templateSelect} WHERE t.team_id = $1 AND t.id = $2`, [teamId, templateId]);
    if (!row) return null;

    const versions = await query<VersionRow>(`
      SELECT * FROM checklist_template_versions
      WHERE template_id = $1
      ORDER BY is_active DESC, created_at DESC
    `, [templateId]);

    return {
      ...mapTemplateRow(row),
      versions: versions.map(mapVersionRow),
    };
  },

  async saveVersion(teamId: string, input: SaveChecklistTemplateInput): Promise<ChecklistTemplateDetail> {
    const client = await getSharedClient();
    const templateId = input.templateId;
    let savedTemplateId = templateId;

    try {
      await client.query('BEGIN');

      if (input.activate) {
        await client.query('UPDATE checklist_templates SET is_active = FALSE, updated_by_email = $1 WHERE team_id = $2', [
          input.uploadedByEmail ?? null,
          teamId,
        ]);
      }

      if (savedTemplateId) {
        await client.query(`
          UPDATE checklist_templates
          SET name = $1,
              description = $2,
              is_active = CASE WHEN $3 = TRUE THEN TRUE ELSE is_active END,
              updated_by_email = $4
          WHERE id = $5 AND team_id = $6
        `, [input.name, input.description ?? null, input.activate, input.uploadedByEmail ?? null, savedTemplateId, teamId]);
      } else {
        const result = await client.query<{ id: string }>(`
          INSERT INTO checklist_templates (team_id, name, description, is_active, created_by_email, updated_by_email)
          VALUES ($1, $2, $3, $4, $5, $5)
          RETURNING id
        `, [teamId, input.name, input.description ?? null, input.activate, input.uploadedByEmail ?? null]);
        savedTemplateId = result.rows[0]?.id;
      }

      if (!savedTemplateId) {
        throw new Error('Failed to create checklist template');
      }

      if (input.activate) {
        await client.query('UPDATE checklist_template_versions SET is_active = FALSE WHERE template_id = $1', [savedTemplateId]);
      }

      await client.query(`
        INSERT INTO checklist_template_versions (
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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
      `, [
        savedTemplateId,
        input.versionLabel,
        input.originalFilename,
        input.mimeType,
        input.sizeBytes,
        input.checksumSha256,
        input.xlsxBuffer,
        input.mappingJson ? JSON.stringify(input.mappingJson) : null,
        input.mappingStatus,
        input.activate,
        input.uploadedByEmail ?? null,
      ]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const template = await this.getById(teamId, savedTemplateId);
    if (!template) {
      throw new Error('Checklist template was not saved');
    }
    return template;
  },

  async activateVersion(teamId: string, templateId: string, versionId: string, updatedByEmail?: string): Promise<ChecklistTemplateDetail | null> {
    const client = await getSharedClient();

    try {
      await client.query('BEGIN');

      const version = await client.query<{ id: string }>(`
        SELECT v.id
        FROM checklist_template_versions v
        INNER JOIN checklist_templates t ON t.id = v.template_id
        WHERE t.team_id = $1 AND t.id = $2 AND v.id = $3
      `, [teamId, templateId, versionId]);

      if (!version.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query('UPDATE checklist_templates SET is_active = FALSE, updated_by_email = $1 WHERE team_id = $2', [updatedByEmail ?? null, teamId]);
      await client.query('UPDATE checklist_templates SET is_active = TRUE, updated_by_email = $1 WHERE id = $2 AND team_id = $3', [updatedByEmail ?? null, templateId, teamId]);
      await client.query('UPDATE checklist_template_versions SET is_active = FALSE WHERE template_id = $1', [templateId]);
      await client.query('UPDATE checklist_template_versions SET is_active = TRUE WHERE id = $1', [versionId]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return this.getById(teamId, templateId);
  },

  async getVersionFile(teamId: string, templateId: string, versionId: string): Promise<ChecklistTemplateFileRecord | null> {
    const row = await queryOne<{
      template_id: string;
      id: string;
      original_filename: string;
      mime_type: string;
      xlsx_blob: Buffer;
    }>(`
      SELECT v.template_id, v.id, v.original_filename, v.mime_type, v.xlsx_blob
      FROM checklist_template_versions v
      INNER JOIN checklist_templates t ON t.id = v.template_id
      WHERE t.team_id = $1 AND t.id = $2 AND v.id = $3
    `, [teamId, templateId, versionId]);

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