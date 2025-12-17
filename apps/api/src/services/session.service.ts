import { v4 as uuidv4 } from 'uuid';

import { getDb } from '../db/client.js';
import { settingsRepository } from '../repositories/settings.repository.js';

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
  heartbeatIntervalSeconds: 60 // Client should ping every 60 seconds
};

export const sessionService = {
  /**
   * Get session configuration
   */
  async getConfig(): Promise<SessionConfig> {
    const stored = await settingsRepository.get<SessionConfig>('session_config');
    return stored?.value ?? DEFAULT_CONFIG;
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
    
    await db.run(
      'UPDATE local_sessions SET last_activity_at = ? WHERE id = ?',
      [now, sessionId]
    );
  },

  /**
   * Record activity by refresh token
   */
  async recordActivityByToken(refreshToken: string): Promise<void> {
    const db = await getDb();
    const now = new Date().toISOString();
    
    await db.run(
      'UPDATE local_sessions SET last_activity_at = ? WHERE refresh_token = ?',
      [now, refreshToken]
    );
  },

  /**
   * Check if session is still valid (not expired or timed out)
   */
  async checkSession(refreshToken: string): Promise<SessionHeartbeatResponse> {
    const db = await getDb();
    const config = await this.getConfig();
    
    const session = await db.get(
      'SELECT * FROM local_sessions WHERE refresh_token = ?',
      [refreshToken]
    );

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
    
    const row = await db.get(
      'SELECT * FROM local_sessions WHERE refresh_token = ?',
      [refreshToken]
    );

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
    
    const rows = await db.all(
      'SELECT * FROM local_sessions WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

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
    
    const row = await db.get(
      `SELECT * FROM local_sessions 
       WHERE user_id = ? AND expires_at > datetime('now') 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

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

    const now = new Date();
    const lastActivity = session.last_activity_at 
      ? new Date(session.last_activity_at) 
      : new Date(session.created_at);
    
    // Check inactivity timeout
    const inactivityMs = config.inactivityTimeoutMinutes * 60 * 1000;
    const timeSinceActivity = now.getTime() - lastActivity.getTime();
    const isTimedOut = timeSinceActivity > inactivityMs;

    return {
      id: session.id,
      userId: session.user_id,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
      lastActivityAt: session.last_activity_at ?? session.created_at,
      ipAddress: session.ip_address ?? undefined,
      userAgent: session.user_agent ?? undefined,
      isActive: !isTimedOut && new Date(session.expires_at) > now
    };
  },

  /**
   * Invalidate a specific session
   */
  async invalidateSession(refreshToken: string): Promise<void> {
    const db = await getDb();
    await db.run('DELETE FROM local_sessions WHERE refresh_token = ?', [refreshToken]);
  },

  /**
   * Invalidate all sessions for a user (force logout everywhere)
   */
  async invalidateAllUserSessions(userId: string): Promise<number> {
    const db = await getDb();
    const result = await db.run('DELETE FROM local_sessions WHERE user_id = ?', [userId]);
    return result.changes ?? 0;
  },

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const db = await getDb();
    const now = new Date().toISOString();
    const result = await db.run(
      'DELETE FROM local_sessions WHERE expires_at < ?',
      [now]
    );
    return result.changes ?? 0;
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
    
    const result = await db.run(
      'DELETE FROM local_sessions WHERE last_activity_at < ?',
      [cutoffTime]
    );
    return result.changes ?? 0;
  },

  /**
   * Start periodic cleanup task (runs every hour)
   * Returns cleanup interval ID
   */
  startPeriodicCleanup(): NodeJS.Timeout {
    const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
    
    return setInterval(async () => {
      try {
        const expired = await this.cleanupExpiredSessions();
        const inactive = await this.cleanupInactiveSessions();
        
        // Only log if sessions were actually cleaned up
        if (expired > 0 || inactive > 0) {
          console.log(`Session cleanup: ${expired} expired, ${inactive} inactive`);
        }
      } catch (error) {
        console.error('Session cleanup failed:', error);
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
