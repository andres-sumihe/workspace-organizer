import { randomUUID } from 'node:crypto';

import type { AppDatabase } from '../db/client.js';
import type { CreateTemplateInput, TemplateSummaryV2, TemplateManifestV2, UpdateTemplateInput } from '@workspace/shared';


export class TemplatesRepository {
  constructor(private readonly db: AppDatabase) {}

  async findAll(): Promise<TemplateSummaryV2[]> {
    const rows = this.db.prepare(`
      SELECT
        t.id,
        t.name,
        t.description,
        t.created_at,
        t.updated_at,
        COUNT(DISTINCT tf.id) as folder_count,
        COUNT(DISTINCT tfile.id) as file_count
      FROM templates t
      LEFT JOIN template_folders tf ON tf.template_id = t.id
      LEFT JOIN template_files tfile ON tfile.template_id = t.id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `).all() as Array<{
      id: string;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      folderCount: (row as unknown as { folder_count: number }).folder_count,
      fileCount: (row as unknown as { file_count: number }).file_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  async findById(id: string): Promise<TemplateManifestV2 | null> {
    const template = this.db.prepare('SELECT * FROM templates WHERE id = ?').get(id) as {
      id: string;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
    } | undefined;

    if (!template) {
      return null;
    }

    const folders = this.db.prepare(
      'SELECT relative_path FROM template_folders WHERE template_id = ? ORDER BY relative_path'
    ).all(id) as Array<{ relative_path: string }>;

    const files = this.db.prepare(
      'SELECT relative_path, content FROM template_files WHERE template_id = ? ORDER BY relative_path'
    ).all(id) as Array<{ relative_path: string; content: string }>;

    const tokens = this.db.prepare(
      'SELECT key, label, default_value FROM template_tokens WHERE template_id = ? ORDER BY key'
    ).all(id) as Array<{ key: string; label: string; default_value: string | null }>;

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      folders: folders.map((f) => ({ relativePath: f.relative_path })),
      files: files.map((f) => ({ relativePath: f.relative_path, content: f.content })),
      tokens: tokens.map((t) => ({
        key: t.key,
        label: t.label,
        defaultValue: t.default_value ?? undefined
      })),
      createdAt: template.created_at,
      updatedAt: template.updated_at
    };
  }

  async create(input: CreateTemplateInput): Promise<TemplateManifestV2> {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(
      'INSERT INTO templates (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, input.name, input.description ?? null, now, now);

    // Insert folders
    for (const folder of input.folders) {
      this.db.prepare('INSERT INTO template_folders (template_id, relative_path) VALUES (?, ?)').run(
        id,
        folder.relativePath
      );
    }

    // Insert files
    for (const file of input.files) {
      this.db.prepare('INSERT INTO template_files (template_id, relative_path, content) VALUES (?, ?, ?)').run(
        id,
        file.relativePath,
        file.content
      );
    }

    // Insert tokens
    for (const token of input.tokens) {
      this.db.prepare(
        'INSERT INTO template_tokens (template_id, key, label, default_value) VALUES (?, ?, ?, ?)'
      ).run(id, token.key, token.label, token.defaultValue ?? null);
    }

    const created = await this.findById(id);
    if (!created) {
      throw new Error('Failed to create template');
    }

    return created;
  }

  async update(id: string, input: UpdateTemplateInput): Promise<TemplateManifestV2 | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const now = new Date().toISOString();

    // Update basic metadata
    if (input.name !== undefined || input.description !== undefined) {
      this.db.prepare('UPDATE templates SET name = COALESCE(?, name), description = ?, updated_at = ? WHERE id = ?').run(
        input.name ?? null,
        input.description ?? null,
        now,
        id
      );
    } else {
      this.db.prepare('UPDATE templates SET updated_at = ? WHERE id = ?').run(now, id);
    }

    // Replace folders if provided
    if (input.folders !== undefined) {
      this.db.prepare('DELETE FROM template_folders WHERE template_id = ?').run(id);
      for (const folder of input.folders) {
        this.db.prepare('INSERT INTO template_folders (template_id, relative_path) VALUES (?, ?)').run(
          id,
          folder.relativePath
        );
      }
    }

    // Replace files if provided
    if (input.files !== undefined) {
      this.db.prepare('DELETE FROM template_files WHERE template_id = ?').run(id);
      for (const file of input.files) {
        this.db.prepare('INSERT INTO template_files (template_id, relative_path, content) VALUES (?, ?, ?)').run(
          id,
          file.relativePath,
          file.content
        );
      }
    }

    // Replace tokens if provided
    if (input.tokens !== undefined) {
      this.db.prepare('DELETE FROM template_tokens WHERE template_id = ?').run(id);
      for (const token of input.tokens) {
        this.db.prepare(
          'INSERT INTO template_tokens (template_id, key, label, default_value) VALUES (?, ?, ?, ?)'
        ).run(id, token.key, token.label, token.defaultValue ?? null);
      }
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM templates WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async assignToWorkspace(workspaceId: string, templateId: string): Promise<void> {
    const now = new Date().toISOString();
    this.db.prepare(
      'INSERT OR REPLACE INTO workspace_templates (workspace_id, template_id, assigned_at) VALUES (?, ?, ?)'
    ).run(workspaceId, templateId, now);
  }

  async unassignFromWorkspace(workspaceId: string, templateId: string): Promise<void> {
    this.db.prepare('DELETE FROM workspace_templates WHERE workspace_id = ? AND template_id = ?').run(
      workspaceId,
      templateId
    );
  }

  async findWorkspaceTemplates(workspaceId: string): Promise<TemplateSummaryV2[]> {
    const rows = this.db.prepare(
      `
      SELECT
        t.id,
        t.name,
        t.description,
        t.created_at,
        t.updated_at,
        COUNT(DISTINCT tf.id) as folder_count,
        COUNT(DISTINCT tfile.id) as file_count
      FROM templates t
      INNER JOIN workspace_templates wt ON wt.template_id = t.id
      LEFT JOIN template_folders tf ON tf.template_id = t.id
      LEFT JOIN template_files tfile ON tfile.template_id = t.id
      WHERE wt.workspace_id = ?
      GROUP BY t.id
      ORDER BY wt.assigned_at DESC
    `
    ).all(workspaceId) as Array<{
      id: string;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      folderCount: (row as unknown as { folder_count: number }).folder_count,
      fileCount: (row as unknown as { file_count: number }).file_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
}
