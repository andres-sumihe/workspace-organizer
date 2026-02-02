import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { CreateCredentialRequest, UpdateCredentialRequest } from '@workspace/shared';

import { credentialsApi, vaultApi, type CredentialsListParams } from '@/api/notes-vault';
import { queryKeys } from '@/lib/query-client';

/**
 * Hook to fetch vault status (is it set up and unlocked)
 */
export function useVaultStatus() {
  return useQuery({
    queryKey: queryKeys.vault.status(),
    queryFn: () => vaultApi.getStatus(),
  });
}

/**
 * Hook to fetch credentials list (only works when vault is unlocked)
 */
export function useCredentialsList(params?: CredentialsListParams, options?: { enabled?: boolean }) {
  return useQuery({  
    queryKey: queryKeys.vault.credentialList(params as Record<string, unknown> | undefined),
    queryFn: () => credentialsApi.list(params),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook to fetch a single credential by ID
 */
export function useCredentialDetail(credentialId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.vault.credentials(), 'detail', credentialId],
    queryFn: () => credentialsApi.getById(credentialId!),
    enabled: !!credentialId,
  });
}

/**
 * Mutation hook for setting up the vault
 * Invalidates vault status on success
 */
export function useSetupVault() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (masterPassword: string) => vaultApi.setup({ masterPassword }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.status() });
    },
  });
}

/**
 * Mutation hook for unlocking the vault
 * Invalidates vault status and credentials on success
 */
export function useUnlockVault() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (masterPassword: string) => vaultApi.unlock({ masterPassword }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.all });
    },
  });
}

/**
 * Mutation hook for locking the vault
 * Invalidates vault status on success
 */
export function useLockVault() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => vaultApi.lock(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.all });
    },
  });
}

/**
 * Mutation hook for revealing a credential (get decrypted data)
 */
export function useRevealCredential() {
  return useMutation({
    mutationFn: (credentialId: string) => credentialsApi.reveal(credentialId),
  });
}

/**
 * Mutation hook for creating a new credential
 * Invalidates credentials list on success
 */
export function useCreateCredential() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCredentialRequest) => credentialsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.credentials() });
    },
  });
}

/**
 * Mutation hook for updating a credential
 * Invalidates credentials list on success
 */
export function useUpdateCredential() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ credentialId, data }: { credentialId: string; data: UpdateCredentialRequest }) =>
      credentialsApi.update(credentialId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.credentials() });
    },
  });
}

/**
 * Mutation hook for deleting a credential
 * Invalidates credentials list on success
 */
export function useDeleteCredential() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentialId: string) => credentialsApi.delete(credentialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vault.credentials() });
    },
  });
}
