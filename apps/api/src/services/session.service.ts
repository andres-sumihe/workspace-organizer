import { v4 as uuidv4 } from 'uuid';

import { getDb } from '../db/client.js';
import { settingsRepository } from '../repositories/settings.repository.js';
import { sessionLogger } from '../utils/logger.js';

import type { SessionConfig, SessionInfo, SessionHeartbeatResponse } from '@workspace/shared';

/**
 * Session Service
 * 
 * Manages session lifecycle, inactivity timeout, and session security.
 * 
 * Security Features:
 * - Inactivity timeout (locks app after period of no activity)
 * - Session heartbeat to keep sessions alive
 * - Single session enforcement (one active session per user)
 * - Session invalidation on suspicious activity
 */

const DEFAULT_CONFIG: SessionConfig = {
  accessTokenExpiryMinutes: 15,
  refreshTokenExpiryDays: 7,
  inactivityTimeoutMinutes: 30, // Lock after 30 minutes of inactivity
  maxConcurrentSessions: 1, // Solo mode: one session only
  heartbeatIntervalSeconds: 60, // Client should ping every 60 seconds
  enableSessionLock: true
};

export const sessionService = {
  /**
   * Get session configuration
   * Always merges stored config with defaults to ensure all fields exist
   */
  async getConfig(): Promise<SessionConfig> {
    const stored = await settingsRepository.get<Partial<SessionConfig>>('session_config');
    // Merge defaults with stored config to ensure all fields exist
    // Stored values take precedence over defaults
    return { ...DEFAULT_CONFIG, ...(stored?.value ?? {}) };
  },

  /**
   * Update session configuration
   */
  async updateConfig(config: Partial<SessionConfig>): Promise<SessionConfig> {
    const current = await this.getConfig();
    const updated = { ...current, ...config };
    await settingsRepository.set('session_config', updated, 'Session configuration');
    return updated;
  },

  /**
   * Record session activity (heartbeat)
   * Updates last_activity_at for the session
   */
  async recordActivity(sessionId: string): Promise<void> {
    const db = await getDb();
    const now = new Date().toISOString();
    
    db.prepare('UPDATE local_sessions SET last_activity_at = ? WHERE id = ?').run(now, sessionId);
  },

  /**
   * Record activity by refresh token
   */
  async recordActivityByToken(refreshToken: string): Promise<void> {
    const db = await getDb();
    const now = new Date().toISOString();
    
    db.prepare('UPDATE local_sessions SET last_activity_at = ? WHERE refresh_token = ?').run(now, refreshToken);
  },

  /**
   * Check if session is still valid (not expired or timed out)
   */
  async checkSession(refreshToken: string): Promise<SessionHeartbeatResponse> {
    const db = await getDb();
    const config = await this.getConfig();
    
    const session = db.prepare('SELECT * FROM local_sessions WHERE refresh_token = ?').get(refreshToken);

    if (!session) {
      return { valid: false, expiresAt: '', shouldRefresh: false };
    }

    const row = session as {
      id: string;
      expires_at: string;
      last_activity_at: string | null;
      created_at: string;
    };

    const now = new Date();
    const expiresAt = new Date(row.expires_at);
    const lastActivity = row.last_activity_at 
      ? new Date(row.last_activity_at) 
      : new Date(row.created_at);

    // Check if session has expired
    if (now > expiresAt) {
      await this.invalidateSession(refreshToken);
      return { valid: false, expiresAt: row.expires_at, shouldRefresh: false };
    }

    // Check inactivity timeout
    // Only if session lock is enabled (default true)
    if (config.enableSessionLock !== false) {
      const inactivityMs = config.inactivityTimeoutMinutes * 60 * 1000;
      const timeSinceActivity = now.getTime() - lastActivity.getTime();
      
      if (timeSinceActivity > inactivityMs) {
        // Session timed out due to inactivity - don't invalidate, just report
        return { 
          valid: false, 
          expiresAt: row.expires_at, 
          shouldRefresh: false 
        };
      }
    }

    // Calculate if token should be refreshed (within 5 minutes of expiry)
    const refreshThreshold = 5 * 60 * 1000;
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const shouldRefresh = timeUntilExpiry < refreshThreshold;

    return {
      valid: true,
      expiresAt: row.expires_at,
      shouldRefresh
    };
  },

  /**
   * Get session info by refresh token
   */
  async getSessionByToken(refreshToken: string): Promise<SessionInfo | null> {
    const db = await getDb();
    
    const row = db.prepare('SELECT * FROM local_sessions WHERE refresh_token = ?').get(refreshToken);

    if (!row) return null;

    const session = row as {
      id: string;
      user_id: string;
      expires_at: string;
      created_at: string;
      last_activity_at: string | null;
      ip_address: string | null;
      user_agent: string | null;
    };

    return {
      id: session.id,
      userId: session.user_id,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
      lastActivityAt: session.last_activity_at ?? session.created_at,
      ipAddress: session.ip_address ?? undefined,
      userAgent: session.user_agent ?? undefined,
      isActive: new Date(session.expires_at) > new Date()
    };
  },

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const db = await getDb();
    
    const rows = db.prepare('SELECT * FROM local_sessions WHERE user_id = ? ORDER BY created_at DESC').all(userId);

    return (rows as Array<{
      id: string;
      user_id: string;
      expires_at: string;
      created_at: string;
      last_activity_at: string | null;
      ip_address: string | null;
      user_agent: string | null;
    }>).map(session => ({
      id: session.id,
      userId: session.user_id,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
      lastActivityAt: session.last_activity_at ?? session.created_at,
      ipAddress: session.ip_address ?? undefined,
      userAgent: session.user_agent ?? undefined,
      isActive: new Date(session.expires_at) > new Date()
    }));
  },

  /**
   * Get the most recent active session info for a user
   */
  async getSessionInfo(userId: string): Promise<SessionInfo | null> {
    const db = await getDb();
    const config = await this.getConfig();

    const row = db.prepare(
      `SELECT * FROM local_sessions 
       WHERE user_id = ? AND expires_at > datetime('now') 
       ORDER BY created_at DESC LIMIT 1`
    ).get(userId);

    if (!row) {
      return null;
    }

    const session = row as {
      id: string;
      user_id: string;
      expires_at: string;
      created_at: string;
      last_activity_at: string | null;
      ip_address: string | null;
      user_agent: string | null;
    };

    const now = new Date();
    const lastActivity = session.last_activity_at 
      ? new Date(session.last_activity_at) 
      : new Date(session.created_at);
    
    // Check inactivity timeout
    let isActive = new Date(session.expires_at) > now;
    
    // Check lock timeout if enabled
    if (config.enableSessionLock !== false) {
      const inactivityMs = config.inactivityTimeoutMinutes * 60 * 1000;
      const timeSinceActivity = now.getTime() - lastActivity.getTime();
      const isTimedOut = timeSinceActivity > inactivityMs;
      isActive = isActive && !isTimedOut;
    }

    return {
      id: session.id,
      userId: session.user_id,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
      lastActivityAt: session.last_activity_at ?? session.created_at,
      ipAddress: session.ip_address ?? undefined,
      userAgent: session.user_agent ?? undefined,
      isActive
    };
  },

  /**
   * Invalidate a specific session
   */
  async invalidateSession(refreshToken: string): Promise<void> {
    const db = await getDb();
    db.prepare('DELETE FROM local_sessions WHERE refresh_token = ?').run(refreshToken);
  },

  /**
   * Invalidate all sessions for a user (force logout everywhere)
   */
  async invalidateAllUserSessions(userId: string): Promise<number> {
    const db = await getDb();
    const result = db.prepare('DELETE FROM local_sessions WHERE user_id = ?').run(userId);
    return result.changes;
  },

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const db = await getDb();
    const now = new Date().toISOString();
    const result = db.prepare('DELETE FROM local_sessions WHERE expires_at < ?').run(now);
    return result.changes;
  },

  /**
   * Clean up inactive sessions (beyond inactivity timeout)
   * This is more aggressive than expiration check - removes sessions that haven't been used
   */
  async cleanupInactiveSessions(): Promise<number> {
    const db = await getDb();
    const config = await this.getConfig();
    
    const inactivityMs = config.inactivityTimeoutMinutes * 60 * 1000;
    const cutoffTime = new Date(Date.now() - inactivityMs).toISOString();
    
    const result = db.prepare('DELETE FROM local_sessions WHERE last_activity_at < ?').run(cutoffTime);
    return result.changes;
  },

  /**
   * Start periodic cleanup task (runs every hour)
   * Returns cleanup interval ID
   */
  startPeriodicCleanup(): ReturnType<typeof setInterval> {
    const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
    
    return setInterval(async () => {
      try {
        const expired = await this.cleanupExpiredSessions();
        const inactive = await this.cleanupInactiveSessions();
        
        // Only log if sessions were actually cleaned up
        if (expired > 0 || inactive > 0) {
          sessionLogger.info({ expired, inactive }, 'Session cleanup completed');
        }
      } catch (error) {
        sessionLogger.error({ err: error }, 'Session cleanup failed');
      }
    }, CLEANUP_INTERVAL);
  },

  /**
   * Generate a new session ID
   */
  generateSessionId(): string {
    return uuidv4();
  }
};
