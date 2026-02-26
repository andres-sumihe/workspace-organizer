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

import { isSharedDbConnected, getSharedPool } from '../db/shared-client.js';
import { pgPubSubService } from './pg-pubsub.service.js';
import { dbLogger } from '../utils/logger.js';

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
            await pgPubSubService.notify({ documentName, serverId: SERVER_ID });
          } catch (err) {
            log.error({ err, documentName }, 'Failed to store Yjs state');
          }
        },
      }),
    ],
  });
}

/**
 * Deterministic color from a string (email) for cursor coloring.
 */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 50%)`;
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

  // When another instance notifies about a document change,
  // reload the document from DB if it's currently open locally.
  pgPubSubService.on('sync', async (data: { documentName: string; serverId?: string }) => {
    if (data.serverId === SERVER_ID) return; // Ignore own notifications
    if (!hocuspocus) return;

    try {
      // Get the list of open documents
      const docs = hocuspocus.documents;
      const doc = docs.get(data.documentName);
      if (!doc) return; // Document not open locally — nothing to do

      // Fetch latest state from DB and apply
      const pool = getSharedPool();
      const result = await pool.query<{ state: Buffer }>(
        'SELECT state FROM team_yjs_updates WHERE document_name = $1',
        [data.documentName]
      );
      if (!result.rows[0]?.state) return;

      const { applyUpdate, encodeStateVector } = await import('yjs');
      const remoteState = result.rows[0].state;
      const sv = encodeStateVector(doc);

      // Apply the remote state as an update
      // We need to diff: decode what's in the DB and apply only what's new
      const { diffUpdate } = await import('yjs');
      const missingUpdate = diffUpdate(remoteState, sv);
      if (missingUpdate.byteLength > 0) {
        applyUpdate(doc, missingUpdate);
        log.debug({ documentName: data.documentName }, 'Applied remote Yjs update');
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
