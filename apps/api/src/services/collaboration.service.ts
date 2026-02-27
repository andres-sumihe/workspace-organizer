/**
 * Hocuspocus collaboration server.
 *
 * Runs inside the local Express API and provides WebSocket-based
 * Yjs document synchronisation for team notes.
 *
 * Persistence uses the shared PostgreSQL `team_yjs_updates` table.
 * Cross-instance sync uses PostgreSQL LISTEN/NOTIFY via pgPubSubService.
 *
 * WebSocket connections are handled by intercepting the HTTP server's
 * `upgrade` event for paths starting with `/api/collaboration/`.
 */

import { Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { WebSocketServer } from 'ws';
import { applyUpdate } from 'yjs';
import { encodeAwarenessUpdate, applyAwarenessUpdate } from 'y-protocols/awareness';

import { isSharedDbConnected, getSharedPool } from '../db/shared-client.js';
import { NoteHistoryExtension } from './note-history.extension.js';
import { pgPubSubService } from './pg-pubsub.service.js';
import { dbLogger } from '../utils/logger.js';

import type { Awareness } from 'y-protocols/awareness';
import type { Server as HttpServer, IncomingMessage } from 'http';

const log = dbLogger.child({ module: 'collab' });

// Unique server ID to ignore self-notifications
const SERVER_ID = crypto.randomUUID();

const COLLAB_PATH_PREFIX = '/api/collaboration';

let hocuspocus: Hocuspocus | null = null;
let wss: WebSocketServer | null = null;

/**
 * Create and configure the Hocuspocus instance.
 */
function createHocuspocus(): Hocuspocus {
  return new Hocuspocus({
    // Hocuspocus will NOT listen on its own port — we handle connections through Express-ws
    quiet: true,

    async onAuthenticate({ token, documentName }) {
      // Token is the JWT bearer token from the frontend.
      // We validate it using the same auth logic as HTTP routes.
      if (!token) throw new Error('No authentication token');

      const { modeAwareAuthProvider } = await import('../auth/mode-aware-auth.provider.js');
      const decoded = await modeAwareAuthProvider.verifyToken(token);
      const user = await modeAwareAuthProvider.getUserById(decoded.userId);

      if (!user || !user.isActive) throw new Error('Unauthorized');

      // Extract teamId from document name format: "team-note:{teamId}:{noteId}"
      const parts = documentName.split(':');
      if (parts.length < 3 || parts[0] !== 'team-note') {
        throw new Error('Invalid document name format');
      }
      const teamId = parts[1];

      // Verify the user is a member of the team
      const { queryOne } = await import('../db/shared-client.js');
      const membership = await queryOne<{ email: string }>(
        'SELECT email FROM team_members WHERE team_id = $1 AND email = $2',
        [teamId, user.email]
      );

      if (!membership) throw new Error('Not a team member');

      return {
        user: {
          id: user.id,
          name: user.displayName ?? user.email,
          email: user.email,
          color: stringToColor(user.email),
        },
      };
    },

    extensions: [
      new NoteHistoryExtension(),
      new Database({
        fetch: async ({ documentName }) => {
          if (!isSharedDbConnected()) return null;
          try {
            const pool = getSharedPool();
            const result = await pool.query<{ state: Buffer }>(
              'SELECT state FROM team_yjs_updates WHERE document_name = $1',
              [documentName]
            );
            return result.rows[0]?.state ?? null;
          } catch (err) {
            log.error({ err, documentName }, 'Failed to fetch Yjs state');
            return null;
          }
        },

        store: async ({ documentName, state }) => {
          if (!isSharedDbConnected()) return;
          try {
            const pool = getSharedPool();
            await pool.query(
              `INSERT INTO team_yjs_updates (document_name, state)
               VALUES ($1, $2)
               ON CONFLICT (document_name)
               DO UPDATE SET state = $2, updated_at = NOW()`,
              [documentName, state]
            );

            // Notify other instances that this document has been updated
            await pgPubSubService.notify({ type: 'sync', documentName, serverId: SERVER_ID });
          } catch (err) {
            log.error({ err, documentName }, 'Failed to store Yjs state');
          }
        },
      }),
    ],

    /**
     * After a document is loaded from DB, attach listeners for cross-instance
     * relay of Yjs updates and awareness changes via PG NOTIFY.
     */
    async afterLoadDocument({ document, documentName }) {
      // --- Direct Yjs update relay ---
      // When a local client edits the document, relay the raw binary update
      // to other server instances immediately (no DB round-trip).
      document.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin === 'remote-sync') return; // Skip updates applied from remote relay

        const b64 = Buffer.from(update).toString('base64');
        // PG NOTIFY has ~8000 byte limit; skip very large updates
        // (those will be picked up by the DB-based sync fallback)
        if (b64.length < 6000) {
          void pgPubSubService.notify({
            type: 'update',
            documentName,
            update: b64,
            serverId: SERVER_ID,
          });
        }
      });

      // --- Awareness relay (cursors, active users) ---
      const awareness: Awareness = document.awareness;
      awareness.on('update', (
        changes: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
      ) => {
        if (origin === 'remote-sync') return; // Skip remote-applied awareness

        const changed = [...changes.added, ...changes.updated, ...changes.removed];
        if (changed.length === 0) return;

        try {
          const encoded = encodeAwarenessUpdate(awareness, changed);
          const b64 = Buffer.from(encoded).toString('base64');
          void pgPubSubService.notify({
            type: 'awareness',
            documentName,
            update: b64,
            serverId: SERVER_ID,
          });
        } catch {
          // Awareness encoding can fail if clients have already disconnected
        }
      });
    },
  });
}

/**
 * Deterministic hex color from a string (email) for cursor coloring.
 * Returns #RRGGBB — Tiptap CollaborationCaret doesn't support HSL.
 */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  // HSL → RGB → hex (s=70%, l=50%)
  const s = 0.7, l = 0.5;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)      { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Get the running Hocuspocus instance (or null if not initialised).
 */
export function getHocuspocus(): Hocuspocus | null {
  return hocuspocus;
}

/**
 * Initialise and start the collaboration server.
 * Should be called after the shared DB is configured.
 * WebSocket routes are attached via setupCollaborationWebSocket.
 */
export async function startCollaborationServer(): Promise<void> {
  if (hocuspocus) return;
  if (!isSharedDbConnected()) {
    log.info('Shared DB not connected — collaboration server not started');
    return;
  }

  hocuspocus = createHocuspocus();

  // Start PostgreSQL Pub/Sub listener
  await pgPubSubService.start();

  // ---- Direct Yjs update relay (fast path) ----
  // Applies binary Yjs updates from other instances immediately.
  pgPubSubService.on('update', (data: { documentName: string; update: string; serverId?: string }) => {
    if (data.serverId === SERVER_ID) return;
    if (!hocuspocus) return;

    const doc = hocuspocus.documents.get(data.documentName);
    if (!doc) return;

    try {
      const buf = Buffer.from(data.update, 'base64');
      applyUpdate(doc, buf, 'remote-sync');
      log.debug({ documentName: data.documentName }, 'Applied remote Yjs update (fast)');
    } catch (err) {
      log.error({ err, documentName: data.documentName }, 'Failed to apply remote update');
    }
  });

  // ---- Awareness relay (cursors, active users) ----
  pgPubSubService.on('awareness', (data: { documentName: string; update: string; serverId?: string }) => {
    if (data.serverId === SERVER_ID) return;
    if (!hocuspocus) return;

    const doc = hocuspocus.documents.get(data.documentName);
    if (!doc) return;

    try {
      const buf = Buffer.from(data.update, 'base64');
      applyAwarenessUpdate(doc.awareness, buf, 'remote-sync');
      log.debug({ documentName: data.documentName }, 'Applied remote awareness update');
    } catch (err) {
      log.error({ err, documentName: data.documentName }, 'Failed to apply remote awareness');
    }
  });

  // ---- DB-sync fallback (large updates that exceeded NOTIFY limit) ----
  // When another instance stores to the DB and notifies, reload from DB.
  pgPubSubService.on('sync', async (data: { documentName: string; serverId?: string }) => {
    if (data.serverId === SERVER_ID) return;
    if (!hocuspocus) return;

    const doc = hocuspocus.documents.get(data.documentName);
    if (!doc) return;

    try {
      const pool = getSharedPool();
      const result = await pool.query<{ state: Buffer }>(
        'SELECT state FROM team_yjs_updates WHERE document_name = $1',
        [data.documentName]
      );
      if (!result.rows[0]?.state) return;

      const { encodeStateVector, diffUpdate } = await import('yjs');
      const remoteState = result.rows[0].state;
      const sv = encodeStateVector(doc);

      const missingUpdate = diffUpdate(remoteState, sv);
      if (missingUpdate.byteLength > 0) {
        applyUpdate(doc, missingUpdate, 'remote-sync');
        log.debug({ documentName: data.documentName }, 'Applied remote Yjs update (DB fallback)');
      }
    } catch (err) {
      log.error({ err, documentName: data.documentName }, 'Failed to apply remote sync');
    }
  });

  log.info('Collaboration server started');
}

/**
 * Attach the collaboration WebSocket handling to an HTTP server.
 * Uses native `ws` library with `noServer: true` to intercept upgrade
 * requests for `/api/collaboration/:documentName`.
 */
export function setupCollaborationWebSocket(server: HttpServer): void {
  if (wss) return; // Already attached

  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = request.url ?? '';

    // Only intercept paths starting with our collaboration prefix
    if (!url.startsWith(COLLAB_PATH_PREFIX)) return;

    if (!hocuspocus) {
      socket.destroy();
      return;
    }

    const hp = hocuspocus;

    wss!.handleUpgrade(request, socket, head, (ws) => {
      hp.handleConnection(ws, request);
    });
  });

  log.info('Collaboration WebSocket upgrade handler registered');
}

/**
 * Stop the collaboration server and clean up.
 */
export async function stopCollaborationServer(): Promise<void> {
  await pgPubSubService.stop();
  if (wss) {
    wss.close();
    wss = null;
  }
  if (hocuspocus) {
    await hocuspocus.closeConnections();
    hocuspocus = null;
  }
  log.info('Collaboration server stopped');
}
