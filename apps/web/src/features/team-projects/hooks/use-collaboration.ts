/**
 * Collaboration hooks for real-time editing.
 *
 * Provides hooks for:
 * - Checking if collaboration server is available
 * - Managing the HocuspocusProvider for a specific document
 */

import { useQuery } from '@tanstack/react-query';
import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

import { fetchCollaborationStatus } from '@/features/team-projects/api/collaboration';
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
 * Build the WebSocket URL for the collaboration server.
 * Points to the /api/collaboration path where the upgrade handler is registered.
 */
function getCollaborationWsUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  const base = apiUrl
    ? apiUrl.replace(/^http/, 'ws')
    : `ws://${window.location.hostname}:4000`;
  return `${base.replace(/\/+$/, '')}/api/collaboration`;
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
 */
export function useCollaborationProvider(
  options: CollaborationProviderOptions
): CollaborationProviderResult {
  const { documentName, enabled } = options;
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<CollaborationUser[]>([]);

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
      setIsConnected(false);
      setIsSynced(false);
      setConnectedUsers([]);
      return;
    }

    // Create a fresh Yjs doc for the document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const wsUrl = getCollaborationWsUrl();

    const provider = new HocuspocusProvider({
      url: wsUrl,
      name: documentName,
      document: ydoc,
      token: getToken(),

      onStatus({ status }: { status: string }) {
        setIsConnected(status === 'connected');
      },

      onSynced({ state }: { state: boolean }) {
        setIsSynced(state);
      },

      onAwarenessUpdate({ states }: { states: { clientId: number; [key: string | number]: unknown }[] }) {
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
        setIsConnected(false);
      },
    });

    providerRef.current = provider;

    return () => {
      provider.destroy();
      ydoc.destroy();
      providerRef.current = null;
      setIsConnected(false);
      setIsSynced(false);
      setConnectedUsers([]);
    };
  }, [documentName, enabled, getToken]);

  return useMemo(
    () => ({
      provider: providerRef.current,
      ydoc: ydocRef.current,
      isConnected,
      isSynced,
      connectedUsers,
    }),
    [isConnected, isSynced, connectedUsers]
  );
}
