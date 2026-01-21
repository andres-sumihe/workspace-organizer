import { apiClient } from './client';

import type {
  Note,
  NoteResponse,
  NoteListResponse,
  CreateNoteRequest,
  UpdateNoteRequest,
  Credential,
  CredentialWithData,
  CredentialResponse,
  CredentialRevealResponse,
  CredentialListResponse,
  CreateCredentialRequest,
  UpdateCredentialRequest,
  VaultUnlockRequest,
  VaultSetupRequest,
  VaultUnlockResponse,
  VaultSetupResponse,
  VaultStatusResponse,
  CredentialType
} from '@workspace/shared';

// ============================================================================
// Notes API
// ============================================================================

export interface NotesListParams {
  projectId?: string;
  search?: string;
}

export const notesApi = {
  /**
   * List notes with optional filters
   */
  list: (params?: NotesListParams) => {
    const query: Record<string, string | undefined> = {};
    if (params?.projectId) query.projectId = params.projectId;
    if (params?.search) query.search = params.search;

    return apiClient.get<NoteListResponse>('/api/v1/notes', { query });
  },

  /**
   * Get a note by ID
   */
  getById: (id: string) => apiClient.get<NoteResponse>(`/api/v1/notes/${id}`),

  /**
   * Create a new note
   */
  create: (data: CreateNoteRequest) =>
    apiClient.post<NoteResponse>('/api/v1/notes', data),

  /**
   * Update a note
   */
  update: (id: string, data: UpdateNoteRequest) =>
    apiClient.put<NoteResponse>(`/api/v1/notes/${id}`, data),

  /**
   * Delete a note
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/notes/${id}`);
  },

  /**
   * Search notes by title or content
   */
  search: (query: string, limit?: number) =>
    apiClient.get<NoteListResponse>('/api/v1/notes/search', {
      query: { q: query, limit: limit?.toString() }
    })
};

// ============================================================================
// Credentials API
// ============================================================================

export interface CredentialsListParams {
  projectId?: string;
  type?: CredentialType;
}

export const credentialsApi = {
  /**
   * List credentials (metadata only)
   */
  list: (params?: CredentialsListParams) => {
    const query: Record<string, string | undefined> = {};
    if (params?.projectId) query.projectId = params.projectId;
    if (params?.type) query.type = params.type;

    return apiClient.get<CredentialListResponse>('/api/v1/credentials', { query });
  },

  /**
   * Get credential metadata by ID
   */
  getById: (id: string) => apiClient.get<CredentialResponse>(`/api/v1/credentials/${id}`),

  /**
   * Reveal credential (get decrypted data)
   */
  reveal: (id: string) =>
    apiClient.post<CredentialRevealResponse>(`/api/v1/credentials/${id}/reveal`),

  /**
   * Create a new credential
   */
  create: (data: CreateCredentialRequest) =>
    apiClient.post<CredentialResponse>('/api/v1/credentials', data),

  /**
   * Update a credential
   */
  update: (id: string, data: UpdateCredentialRequest) =>
    apiClient.put<CredentialResponse>(`/api/v1/credentials/${id}`, data),

  /**
   * Delete a credential
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/credentials/${id}`);
  }
};

// ============================================================================
// Vault API
// ============================================================================

export const vaultApi = {
  /**
   * Get vault status (is it set up and unlocked)
   */
  getStatus: () => apiClient.get<VaultStatusResponse>('/api/v1/vault/status'),

  /**
   * Set up the vault with master password
   */
  setup: (data: VaultSetupRequest) =>
    apiClient.post<VaultSetupResponse>('/api/v1/vault/setup', data),

  /**
   * Unlock the vault with master password
   */
  unlock: (data: VaultUnlockRequest) =>
    apiClient.post<VaultUnlockResponse>('/api/v1/vault/unlock', data),

  /**
   * Lock the vault
   */
  lock: () => apiClient.post<{ success: boolean; message?: string }>('/api/v1/vault/lock')
};

// Re-export types for convenience
export type {
  Note,
  Credential,
  CredentialWithData,
  CreateNoteRequest,
  UpdateNoteRequest,
  CreateCredentialRequest,
  UpdateCredentialRequest
};
