import { getDb } from '../db/client.js';

import type { Credential, CredentialType, PersonalProject } from '@workspace/shared';

interface CredentialRow {
  id: string;
  title: string;
  type: string;
  encrypted_blob: string;
  iv: string;
  auth_tag: string;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined project fields
  project_title?: string | null;
  project_status?: string | null;
}

const isCredentialRow = (value: unknown): value is CredentialRow => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.encrypted_blob === 'string' &&
    typeof candidate.iv === 'string' &&
    typeof candidate.auth_tag === 'string' &&
    typeof candidate.created_at === 'string' &&
    typeof candidate.updated_at === 'string'
  );
};

const mapRowToCredential = (row: CredentialRow): Credential => ({
  id: row.id,
  title: row.title,
  type: row.type as CredentialType,
  projectId: row.project_id ?? undefined,
  project: row.project_title
    ? ({
        id: row.project_id!,
        title: row.project_title,
        status: row.project_status ?? 'active'
      } as PersonalProject)
    : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export interface CredentialEncryptedData {
  encryptedBlob: string;
  iv: string;
  authTag: string;
}

export interface CreateCredentialData {
  id: string;
  title: string;
  type: CredentialType;
  encryptedBlob: string;
  iv: string;
  authTag: string;
  projectId?: string;
}

export interface UpdateCredentialData {
  title?: string;
  type?: CredentialType;
  encryptedBlob?: string;
  iv?: string;
  authTag?: string;
  projectId?: string | null;
}

export interface ListCredentialsParams {
  projectId?: string;
  type?: CredentialType;
}

export const credentialsRepository = {
  /**
   * Create a new credential
   */
  async create(data: CreateCredentialData): Promise<Credential> {
    const db = await getDb();

    db.prepare(
      `INSERT INTO credentials (id, title, type, encrypted_blob, iv, auth_tag, project_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      data.id,
      data.title,
      data.type,
      data.encryptedBlob,
      data.iv,
      data.authTag,
      data.projectId ?? null
    );

    const credential = await this.getById(data.id);
    if (!credential) throw new Error(`Failed to retrieve credential after insert: ${data.id}`);
    return credential;
  },

  /**
   * Get credential metadata by ID (no encrypted data)
   */
  async getById(id: string): Promise<Credential | null> {
    const db = await getDb();
    const row = db
      .prepare(
        `SELECT c.*, p.title as project_title, p.status as project_status
         FROM credentials c
         LEFT JOIN personal_projects p ON c.project_id = p.id
         WHERE c.id = ?`
      )
      .get(id);
    if (!isCredentialRow(row)) return null;
    return mapRowToCredential(row);
  },

  /**
   * Get credential with encrypted data by ID
   */
  async getEncryptedById(id: string): Promise<(Credential & CredentialEncryptedData) | null> {
    const db = await getDb();
    const row = db
      .prepare(
        `SELECT c.*, p.title as project_title, p.status as project_status
         FROM credentials c
         LEFT JOIN personal_projects p ON c.project_id = p.id
         WHERE c.id = ?`
      )
      .get(id);
    if (!isCredentialRow(row)) return null;
    return {
      ...mapRowToCredential(row),
      encryptedBlob: row.encrypted_blob,
      iv: row.iv,
      authTag: row.auth_tag
    };
  },

  /**
   * List credentials (metadata only, no encrypted data)
   */
  async list(params: ListCredentialsParams = {}): Promise<Credential[]> {
    const db = await getDb();

    let query = `
      SELECT c.*, p.title as project_title, p.status as project_status
      FROM credentials c
      LEFT JOIN personal_projects p ON c.project_id = p.id
      WHERE 1=1
    `;
    const queryParams: string[] = [];

    if (params.projectId) {
      query += ' AND c.project_id = ?';
      queryParams.push(params.projectId);
    }

    if (params.type) {
      query += ' AND c.type = ?';
      queryParams.push(params.type);
    }

    query += ' ORDER BY c.title ASC';

    const rows = db.prepare(query).all(...queryParams) as unknown[];
    return rows.filter(isCredentialRow).map(mapRowToCredential);
  },

  /**
   * Update a credential by ID
   */
  async update(id: string, data: UpdateCredentialData): Promise<Credential | null> {
    const db = await getDb();

    const updates: string[] = [];
    const params: (string | null)[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.type !== undefined) {
      updates.push('type = ?');
      params.push(data.type);
    }
    if (data.encryptedBlob !== undefined) {
      updates.push('encrypted_blob = ?');
      params.push(data.encryptedBlob);
    }
    if (data.iv !== undefined) {
      updates.push('iv = ?');
      params.push(data.iv);
    }
    if (data.authTag !== undefined) {
      updates.push('auth_tag = ?');
      params.push(data.authTag);
    }
    if (data.projectId !== undefined) {
      updates.push('project_id = ?');
      params.push(data.projectId);
    }

    if (updates.length === 0) {
      return this.getById(id);
    }

    params.push(id);
    db.prepare(`UPDATE credentials SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    return this.getById(id);
  },

  /**
   * Delete a credential by ID
   * Returns true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    const db = await getDb();
    const result = db.prepare('DELETE FROM credentials WHERE id = ?').run(id);
    return result.changes > 0;
  }
};

// Vault settings repository
interface VaultSettingsRow {
  id: string;
  password_hash: string;
  salt: string;
  created_at: string;
  updated_at: string;
}

const isVaultSettingsRow = (value: unknown): value is VaultSettingsRow => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.password_hash === 'string' &&
    typeof candidate.salt === 'string'
  );
};

export interface VaultSettings {
  passwordHash: string;
  salt: string;
}

export const vaultSettingsRepository = {
  /**
   * Check if vault is set up (has master password)
   */
  async isSetup(): Promise<boolean> {
    const db = await getDb();
    const row = db.prepare('SELECT id FROM vault_settings WHERE id = ?').get('default');
    return row !== undefined;
  },

  /**
   * Get vault settings
   */
  async get(): Promise<VaultSettings | null> {
    const db = await getDb();
    const row = db.prepare('SELECT * FROM vault_settings WHERE id = ?').get('default');
    if (!isVaultSettingsRow(row)) return null;
    return {
      passwordHash: row.password_hash,
      salt: row.salt
    };
  },

  /**
   * Set up vault with initial password hash and salt
   */
  async setup(passwordHash: string, salt: string): Promise<void> {
    const db = await getDb();
    db.prepare(
      `INSERT INTO vault_settings (id, password_hash, salt)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET password_hash = ?, salt = ?`
    ).run('default', passwordHash, salt, passwordHash, salt);
  },

  /**
   * Update vault password
   */
  async updatePassword(passwordHash: string, salt: string): Promise<void> {
    const db = await getDb();
    db.prepare(
      `UPDATE vault_settings SET password_hash = ?, salt = ? WHERE id = ?`
    ).run(passwordHash, salt, 'default');
  }
};
