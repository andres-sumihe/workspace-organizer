/**
 * Collaboration hooks for real-time editing.
 *
 * Provides hooks for:
 * - Checking if collaboration server is available
 * - Managing the HocuspocusProvider for a specific document
 */

import { useQuery } from '@tanstack/react-query';
import { useRef, useEffect, useCallback, useState } from 'react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

import { fetchCollaborationStatus } from '@/features/team-projects/api/collaboration';
import { getApiWsBaseUrl } from '@/lib/api-base-url';
import { queryKeys } from '@/lib/query-client';

import type { CollaborationUser } from '@workspace/shared';

/**
 * Check whether the collaboration server is available.
 */
export function useCollaborationStatus() {
  return useQuery({
    queryKey: queryKeys.collaboration.status(),
    queryFn: fetchCollaborationStatus,
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * Resolve the WebSocket URL for the collaboration server asynchronously.
 * Uses the shared api-base-url utility so Electron production gets the
 * correct `ws://127.0.0.1:<port>` instead of the broken `ws://bundle:4000`.
 */
async function resolveCollaborationWsUrl(): Promise<string> {
  const base = await getApiWsBaseUrl();
  return `${base}/api/collaboration`;
}

export interface CollaborationProviderOptions {
  /** Yjs document name, e.g. "team-note:{teamId}:{noteId}" */
  documentName: string;
  /** Whether collaboration is available */
  enabled: boolean;
}

export interface CollaborationProviderResult {
  provider: HocuspocusProvider | null;
  ydoc: Y.Doc;
  isConnected: boolean;
  isSynced: boolean;
  connectedUsers: CollaborationUser[];
}

/**
 * Manage a HocuspocusProvider for a specific Yjs document.
 * Handles lifecycle, authentication, and awareness state.
 *
 * Uses state (not refs) for provider/ydoc so consumers re-render
 * when the provider becomes available.
 */
export function useCollaborationProvider(
  options: CollaborationProviderOptions
): CollaborationProviderResult {
  const { documentName, enabled } = options;
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [ydoc, setYdoc] = useState<Y.Doc>(() => new Y.Doc());
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<CollaborationUser[]>([]);
  const providerRef = useRef<HocuspocusProvider | null>(null);

  const getToken = useCallback(() => {
    return localStorage.getItem('auth_access_token') ?? '';
  }, []);

  useEffect(() => {
    if (!enabled || !documentName) {
      // Clean up any existing provider
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      setProvider(null);
      setIsConnected(false);
      setIsSynced(false);
      setConnectedUsers([]);
      return;
    }

    let cancelled = false;

    void resolveCollaborationWsUrl().then((wsUrl) => {
      if (cancelled) return;

      // Create a fresh Yjs doc for the document
      const newYdoc = new Y.Doc();
      setYdoc(newYdoc);

      const newProvider = new HocuspocusProvider({
        url: wsUrl,
        name: documentName,
        document: newYdoc,
        token: getToken(),

        onStatus({ status }: { status: string }) {
          if (!cancelled) setIsConnected(status === 'connected');
        },

        onSynced({ state }: { state: boolean }) {
          if (!cancelled) setIsSynced(state);
        },

        onAwarenessUpdate({ states }: { states: { clientId: number; [key: string | number]: unknown }[] }) {
          if (cancelled) return;
          const users: CollaborationUser[] = [];
          for (const state of states) {
            if (state.user) {
              users.push(state.user as CollaborationUser);
            }
          }
          setConnectedUsers(users);
        },

        onAuthenticationFailed({ reason }: { reason: string }) {
          console.error('Collaboration auth failed:', reason);
          if (!cancelled) setIsConnected(false);
        },
      });

      providerRef.current = newProvider;
      setProvider(newProvider);
    });

    return () => {
      cancelled = true;
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      setProvider(null);
      setIsConnected(false);
      setIsSynced(false);
      setConnectedUsers([]);
    };
  }, [documentName, enabled, getToken]);

  return { provider, ydoc, isConnected, isSynced, connectedUsers };
}
