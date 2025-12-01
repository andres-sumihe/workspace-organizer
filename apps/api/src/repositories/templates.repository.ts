import { randomUUID } from 'node:crypto';

import type { AppDatabase } from '../db/client.js';
import type { CreateTemplateInput, TemplateSummaryV2, TemplateManifestV2, UpdateTemplateInput } from '@workspace/shared';


export class TemplatesRepository {
  constructor(private readonly db: AppDatabase) {}

  async findAll(): Promise<TemplateSummaryV2[]> {
    const rows = await this.db.all<
      Array<{
        id: string;
        name: string;
        description: string | null;
        created_at: string;
        updated_at: string;
      }>
    >(`
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
    `);

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
    const template = await this.db.get<{
      id: string;
      name: string;
      description: string | null;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM templates WHERE id = ?', [id]);

    if (!template) {
      return null;
    }

    const folders = await this.db.all<Array<{ relative_path: string }>>(
      'SELECT relative_path FROM template_folders WHERE template_id = ? ORDER BY relative_path',
      [id]
    );

    const files = await this.db.all<Array<{ relative_path: string; content: string }>>(
      'SELECT relative_path, content FROM template_files WHERE template_id = ? ORDER BY relative_path',
      [id]
    );

    const tokens = await this.db.all<Array<{ key: string; label: string; default_value: string | null }>>(
      'SELECT key, label, default_value FROM template_tokens WHERE template_id = ? ORDER BY key',
      [id]
    );

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

    await this.db.run(
      'INSERT INTO templates (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, input.name, input.description ?? null, now, now]
    );

    // Insert folders
    for (const folder of input.folders) {
      await this.db.run('INSERT INTO template_folders (template_id, relative_path) VALUES (?, ?)', [
        id,
        folder.relativePath
      ]);
    }

    // Insert files
    for (const file of input.files) {
      await this.db.run('INSERT INTO template_files (template_id, relative_path, content) VALUES (?, ?, ?)', [
        id,
        file.relativePath,
        file.content
      ]);
    }

    // Insert tokens
    for (const token of input.tokens) {
      await this.db.run(
        'INSERT INTO template_tokens (template_id, key, label, default_value) VALUES (?, ?, ?, ?)',
        [id, token.key, token.label, token.defaultValue ?? null]
      );
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
      await this.db.run('UPDATE templates SET name = COALESCE(?, name), description = ?, updated_at = ? WHERE id = ?', [
        input.name ?? null,
        input.description ?? null,
        now,
        id
      ]);
    } else {
      await this.db.run('UPDATE templates SET updated_at = ? WHERE id = ?', [now, id]);
    }

    // Replace folders if provided
    if (input.folders !== undefined) {
      await this.db.run('DELETE FROM template_folders WHERE template_id = ?', [id]);
      for (const folder of input.folders) {
        await this.db.run('INSERT INTO template_folders (template_id, relative_path) VALUES (?, ?)', [
          id,
          folder.relativePath
        ]);
      }
    }

    // Replace files if provided
    if (input.files !== undefined) {
      await this.db.run('DELETE FROM template_files WHERE template_id = ?', [id]);
      for (const file of input.files) {
        await this.db.run('INSERT INTO template_files (template_id, relative_path, content) VALUES (?, ?, ?)', [
          id,
          file.relativePath,
          file.content
        ]);
      }
    }

    // Replace tokens if provided
    if (input.tokens !== undefined) {
      await this.db.run('DELETE FROM template_tokens WHERE template_id = ?', [id]);
      for (const token of input.tokens) {
        await this.db.run(
          'INSERT INTO template_tokens (template_id, key, label, default_value) VALUES (?, ?, ?, ?)',
          [id, token.key, token.label, token.defaultValue ?? null]
        );
      }
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM templates WHERE id = ?', [id]);
    return (result.changes ?? 0) > 0;
  }

  async assignToWorkspace(workspaceId: string, templateId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.run(
      'INSERT OR REPLACE INTO workspace_templates (workspace_id, template_id, assigned_at) VALUES (?, ?, ?)',
      [workspaceId, templateId, now]
    );
  }

  async unassignFromWorkspace(workspaceId: string, templateId: string): Promise<void> {
    await this.db.run('DELETE FROM workspace_templates WHERE workspace_id = ? AND template_id = ?', [
      workspaceId,
      templateId
    ]);
  }

  async findWorkspaceTemplates(workspaceId: string): Promise<TemplateSummaryV2[]> {
    const rows = await this.db.all<
      Array<{
        id: string;
        name: string;
        description: string | null;
        created_at: string;
        updated_at: string;
      }>
    >(
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
    `,
      [workspaceId]
    );

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
