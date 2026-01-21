import { randomUUID } from 'node:crypto';

import { cryptoService, hashPassword, generateSalt } from './crypto.service.js';
import {
  credentialsRepository,
  vaultSettingsRepository,
  type CreateCredentialData,
  type UpdateCredentialData,
  type ListCredentialsParams
} from '../repositories/credentials.repository.js';

import type {
  Credential,
  CredentialWithData,
  CredentialData,
  CreateCredentialRequest,
  UpdateCredentialRequest,
  VaultStatusResponse
} from '@workspace/shared';

export const credentialsService = {
  /**
   * Get vault status (is it set up and unlocked)
   */
  async getStatus(): Promise<VaultStatusResponse> {
    const isSetup = await vaultSettingsRepository.isSetup();
    return {
      isSetup,
      isUnlocked: cryptoService.isUnlocked()
    };
  },

  /**
   * Set up the vault with initial master password
   * @throws Error if vault is already set up
   */
  async setupVault(masterPassword: string): Promise<void> {
    const isSetup = await vaultSettingsRepository.isSetup();
    if (isSetup) {
      throw new Error('Vault is already set up');
    }

    if (!masterPassword || masterPassword.length < 8) {
      throw new Error('Master password must be at least 8 characters');
    }

    const salt = generateSalt();
    const passwordHash = hashPassword(masterPassword, salt);

    await vaultSettingsRepository.setup(passwordHash, salt.toString('base64'));

    // Auto-unlock after setup
    cryptoService.unlock(masterPassword, salt);
  },

  /**
   * Unlock the vault with master password
   * @throws Error if password is incorrect or vault not set up
   */
  async unlockVault(masterPassword: string): Promise<void> {
    const settings = await vaultSettingsRepository.get();
    if (!settings) {
      throw new Error('Vault is not set up. Please set up the vault first.');
    }

    const salt = Buffer.from(settings.salt, 'base64');
    const passwordHash = hashPassword(masterPassword, salt);

    if (passwordHash !== settings.passwordHash) {
      throw new Error('Incorrect master password');
    }

    cryptoService.unlock(masterPassword, salt);
  },

  /**
   * Lock the vault (clear the key from memory)
   */
  lockVault(): void {
    cryptoService.lock();
  },

  /**
   * Create a new credential
   * @throws Error if vault is locked
   */
  async create(request: CreateCredentialRequest): Promise<Credential> {
    // Encrypt the credential data
    const encrypted = cryptoService.encryptData(request.data);

    const data: CreateCredentialData = {
      id: randomUUID(),
      title: request.title.trim(),
      type: request.type ?? 'generic',
      encryptedBlob: encrypted.encryptedBlob,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      projectId: request.projectId
    };

    return credentialsRepository.create(data);
  },

  /**
   * Get credential metadata by ID (no decrypted data)
   */
  async getById(id: string): Promise<Credential | null> {
    return credentialsRepository.getById(id);
  },

  /**
   * Get credential with decrypted data
   * @throws Error if vault is locked or credential not found
   */
  async reveal(id: string): Promise<CredentialWithData> {
    const encrypted = await credentialsRepository.getEncryptedById(id);
    if (!encrypted) {
      throw new Error(`Credential with ID "${id}" not found`);
    }

    // Decrypt the data
    const data = cryptoService.decryptData<CredentialData>(
      encrypted.encryptedBlob,
      encrypted.iv,
      encrypted.authTag
    );

    return {
      id: encrypted.id,
      title: encrypted.title,
      type: encrypted.type,
      projectId: encrypted.projectId,
      project: encrypted.project,
      createdAt: encrypted.createdAt,
      updatedAt: encrypted.updatedAt,
      data
    };
  },

  /**
   * List credentials (metadata only)
   */
  async list(params: ListCredentialsParams = {}): Promise<Credential[]> {
    return credentialsRepository.list(params);
  },

  /**
   * Update a credential
   * @throws Error if vault is locked or credential not found
   */
  async update(id: string, request: UpdateCredentialRequest): Promise<Credential> {
    const existing = await credentialsRepository.getById(id);
    if (!existing) {
      throw new Error(`Credential with ID "${id}" not found`);
    }

    const data: UpdateCredentialData = {};
    if (request.title !== undefined) data.title = request.title.trim();
    if (request.type !== undefined) data.type = request.type;
    if (request.projectId !== undefined) data.projectId = request.projectId;

    // If data is being updated, re-encrypt
    if (request.data !== undefined) {
      const encrypted = cryptoService.encryptData(request.data);
      data.encryptedBlob = encrypted.encryptedBlob;
      data.iv = encrypted.iv;
      data.authTag = encrypted.authTag;
    }

    const updated = await credentialsRepository.update(id, data);
    if (!updated) {
      throw new Error(`Failed to update credential with ID "${id}"`);
    }

    return updated;
  },

  /**
   * Delete a credential
   * Returns true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    return credentialsRepository.delete(id);
  }
};
