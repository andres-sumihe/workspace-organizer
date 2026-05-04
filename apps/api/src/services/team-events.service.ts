/**
 * Team Events service — real-time push for team CRUD operations.
 *
 * Uses PostgreSQL LISTEN/NOTIFY on the `team_events` channel to
 * broadcast mutations across API instances.  SSE clients subscribe
 * per-team and receive events filtered to their team.
 *
 * Event flow:
 *   Route handler  →  teamEvents.emit(...)  →  PG NOTIFY
 *                                               ↓
 *   PG LISTEN  →  teamEvents (EventEmitter)  →  SSE response
 */

import { EventEmitter } from 'events';

import { Client } from 'pg';

import {
  getSharedDbConnectionString,
  isSharedDbConnected,
  query as pgQuery,
} from '../db/shared-client.js';
import { dbLogger } from '../utils/logger.js';

const CHANNEL = 'team_events';
const RECONNECT_DELAY_MS = 5_000;
const log = dbLogger.child({ module: 'team-events' });

const SERVER_ID = crypto.randomUUID();

export interface TeamEvent {
  /** The team this event belongs to */
  teamId: string;
  /** Resource type that changed */
  resource: 'task' | 'taskUpdate' | 'note' | 'project' | 'calendar' | 'wfh';
  /** What happened */
  action: 'created' | 'updated' | 'deleted';
  /** ID of the changed resource */
  resourceId: string;
  /** Optional parent context (e.g. projectId for tasks, taskId for updates) */
  parentId?: string;
  /** Second-level parent (e.g. projectId for task updates) */
  grandParentId?: string;
  /** Email of the user who made the change */
  actorEmail?: string;
}

class TeamEventsService extends EventEmitter {
  private client: Client | null = null;
  private reconnecting = false;
  private destroyed = false;

  async start(): Promise<void> {
    if (this.client) return;
    if (!isSharedDbConnected()) {
      log.info('Shared DB not connected — skipping team events listener');
      return;
    }

    const connStr = await getSharedDbConnectionString();
    if (!connStr) {
      log.warn('No shared DB connection string — cannot start team events');
      return;
    }

    await this.connect(connStr);
  }

  private async connect(connStr: string): Promise<void> {
    try {
      this.client = new Client({ connectionString: connStr });

      this.client.on('error', (err) => {
        log.error({ err }, 'Team events client error');
        this.scheduleReconnect(connStr);
      });

      this.client.on('end', () => {
        if (!this.destroyed) {
          log.warn('Team events connection closed unexpectedly');
          this.scheduleReconnect(connStr);
        }
      });

      this.client.on('notification', (msg) => {
        if (msg.channel === CHANNEL && msg.payload) {
          try {
            const data = JSON.parse(msg.payload) as TeamEvent & { serverId?: string };
            // Always emit (including own events) — the SSE handler skips
            // events whose actorEmail matches the connected user.
            this.emit('event', data);
          } catch {
            log.warn('Invalid team events notification payload');
          }
        }
      });

      await this.client.connect();
      await this.client.query(`LISTEN ${CHANNEL}`);
      log.info('Team events listener started');
    } catch (err) {
      log.error({ err }, 'Failed to start team events listener');
      this.client = null;
      this.scheduleReconnect(connStr);
    }
  }

  private scheduleReconnect(connStr: string): void {
    if (this.reconnecting || this.destroyed) return;
    this.reconnecting = true;
    this.client = null;

    setTimeout(async () => {
      this.reconnecting = false;
      if (!this.destroyed) {
        log.info('Reconnecting team events listener…');
        await this.connect(connStr);
      }
    }, RECONNECT_DELAY_MS);
  }

  /**
   * Broadcast a team event to all connected instances via PG NOTIFY.
   */
  async broadcast(event: TeamEvent): Promise<boolean> {
    if (!isSharedDbConnected()) return false;

    try {
      const payload = JSON.stringify({ ...event, serverId: SERVER_ID });
      await pgQuery('SELECT pg_notify($1, $2)', [CHANNEL, payload]);
      return true;
    } catch (err) {
      log.error({ err }, 'Failed to send team event notification');
      return false;
    }
  }

  async stop(): Promise<void> {
    this.destroyed = true;
    if (this.client) {
      try {
        await this.client.end();
      } catch {
        // ignore close errors
      }
      this.client = null;
    }
    this.removeAllListeners();
    log.info('Team events listener stopped');
  }
}

export const teamEventsService = new TeamEventsService();
