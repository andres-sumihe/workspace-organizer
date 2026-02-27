/**
 * PostgreSQL Pub/Sub service for real-time collaboration.
 *
 * Uses a dedicated long-lived pg.Client connection with LISTEN/NOTIFY
 * to broadcast Yjs updates between local Hocuspocus instances.
 *
 * Notifications are *signals* that indicate new data is available;
 * the actual binary payload is fetched from the team_yjs_updates table.
 */

import { Client } from 'pg';
import { EventEmitter } from 'events';

import { getSharedDbConnectionString, isSharedDbConnected } from '../db/shared-client.js';
import { dbLogger } from '../utils/logger.js';

const CHANNEL = 'hocuspocus_sync';
const RECONNECT_DELAY_MS = 5000;

const log = dbLogger.child({ module: 'pg-pubsub' });

class PgPubSubService extends EventEmitter {
  private client: Client | null = null;
  private reconnecting = false;
  private destroyed = false;

  /**
   * Start listening for collaboration events.
   * Should be called once at server startup when shared DB is configured.
   */
  async start(): Promise<void> {
    if (this.client) return;
    if (!isSharedDbConnected()) {
      log.info('Shared DB not connected — skipping Pub/Sub listener');
      return;
    }

    const connStr = await getSharedDbConnectionString();
    if (!connStr) {
      log.warn('No shared DB connection string — cannot start Pub/Sub');
      return;
    }

    await this.connect(connStr);
  }

  private async connect(connStr: string): Promise<void> {
    try {
      this.client = new Client({ connectionString: connStr });

      this.client.on('error', (err) => {
        log.error({ err }, 'PgPubSub client error');
        this.scheduleReconnect(connStr);
      });

      this.client.on('end', () => {
        if (!this.destroyed) {
          log.warn('PgPubSub connection closed unexpectedly');
          this.scheduleReconnect(connStr);
        }
      });

      this.client.on('notification', (msg) => {
        if (msg.channel === CHANNEL && msg.payload) {
          try {
            const data = JSON.parse(msg.payload) as Record<string, unknown>;
            // Emit typed events: 'update', 'awareness', or default 'sync'
            const type = typeof data.type === 'string' ? data.type : 'sync';
            this.emit(type, data);
          } catch {
            log.warn('Invalid PgPubSub notification payload');
          }
        }
      });

      await this.client.connect();
      await this.client.query(`LISTEN ${CHANNEL}`);
      log.info('PgPubSub listener started');
    } catch (err) {
      log.error({ err }, 'Failed to start PgPubSub listener');
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
        log.info('Reconnecting PgPubSub listener...');
        await this.connect(connStr);
      }
    }, RECONNECT_DELAY_MS);
  }

  /**
   * Publish a collaboration event to other instances.
   * Payload must be < 8000 bytes (PostgreSQL limit).
   */
  async notify(data: Record<string, unknown>): Promise<void> {
    if (!isSharedDbConnected()) return;

    // Use the pool (not the listener client) for NOTIFY
    try {
      const { query } = await import('../db/shared-client.js');
      const payload = JSON.stringify(data);
      await query(`SELECT pg_notify($1, $2)`, [CHANNEL, payload]);
    } catch (err) {
      log.error({ err }, 'Failed to send PgPubSub notification');
    }
  }

  /**
   * Stop the Pub/Sub listener and clean up.
   */
  async stop(): Promise<void> {
    this.destroyed = true;
    if (this.client) {
      try {
        await this.client.end();
      } catch {
        // ignore close errors on teardown
      }
      this.client = null;
    }
    this.removeAllListeners();
    log.info('PgPubSub listener stopped');
  }
}

export const pgPubSubService = new PgPubSubService();
